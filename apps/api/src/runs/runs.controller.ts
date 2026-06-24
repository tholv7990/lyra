import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { ZipArchive } from 'archiver';
import type { ActionStep, Asset as AssetModel, Product, Run as RunModel, StepCondition, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { CurrentProject } from '../projects/decorators/project.decorators';
import type { ProjectDocument } from '../projects/project.schema';
import { PipelinesService } from '../pipelines/pipelines.service';
import type { PipelineDocument } from '../pipelines/pipeline.schema';
import { ResearchTemplateService } from '../pipelines/research-template.service';
import { TasksService } from '../tasks/tasks.service';
import type { TaskDocument } from '../tasks/task.schema';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireCreate } from '../workspaces/decorators/require-create.decorator';
import { AssetsService } from '../assets/assets.service';
import { ProductsService } from '../products/products.service';
import { RunsService } from './runs.service';
import type { PipelineRunInput } from './runs.service';
import { RunAccessGuard } from './guards/run-access.guard';
import { CurrentRun } from './decorators/current-run.decorator';
import type { RunDocument } from './run.schema';
import { ImageActionBody, RateRunBody, RunPipelineBody, RunStepBody, UpdatePromptBody } from './dto/runs.dto';

// Merge entered values with the pipeline's variable definitions: only keys the
// pipeline declares are kept; a missing value falls back to the variable default.
function mergeCustomVars(
  defs: { key: string; default?: string }[] = [],
  supplied?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) {
    const v = supplied?.[d.key];
    out[d.key] = typeof v === 'string' ? v : d.default ?? '';
  }
  return out;
}

@Controller()
export class RunsController {
  constructor(
    private readonly runs: RunsService,
    private readonly pipelines: PipelinesService,
    private readonly assets: AssetsService,
    private readonly tasks: TasksService,
    private readonly products: ProductsService,
    private readonly research: ResearchTemplateService,
  ) {}

  // Load the task on this project, or 404. Ensures the :taskId belongs to the
  // project the access guard already authorized.
  private async taskOnProject(project: ProjectDocument, taskId: string): Promise<TaskDocument> {
    const task = await this.tasks.findActiveById(taskId);
    if (!task || task.projectId !== project._id.toString()) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  // Build the run-creation input for a pipeline in a project's context — shared by
  // the single-pipeline run and the "run all pipelines" composition endpoint.
  // When `copy` is provided (a project-scoped product copy), its fields are merged
  // into `projectVariables` to seed the branding pipeline.
  private projectRunInput(
    project: ProjectDocument,
    task: TaskDocument,
    pipeline: PipelineDocument,
    body: RunPipelineBody,
    copy?: Product,
  ): PipelineRunInput {
    const projectVariables: Record<string, string> = Object.fromEntries(
      (project.variables ?? []).map((v) => [v.key, v.value]),
    );
    let collections = body.collections;
    if (copy) {
      projectVariables['product'] = copy.name;
      if (copy.niche) projectVariables['niche'] = copy.niche;
      if (copy.price != null) projectVariables['price'] = String(copy.price);
      if (copy.offer) projectVariables['offer'] = copy.offer;
      collections = { ...(body.collections ?? {}), productImages: copy.images ?? [] };
    }
    return {
      ...(copy ? { productId: copy.id } : {}),
      projectId: project._id.toString(),
      taskId: task._id.toString(),
      workspaceId: project.workspaceId,
      pipelineId: pipeline._id.toString(),
      pipelineName: pipeline.name,
      projectVariables,
      note: pipeline.description ?? '',
      variables: mergeCustomVars(pipeline.variables, body.variables),
      collections,
      steps: pipeline.steps.map((s) => ({
        id: s.id,
        name: s.name,
        promptId: s.promptId,
        promptOverride: s.promptOverride,
        review: s.review,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
        fanOut: s.fanOut,
        condition: s.condition as StepCondition | undefined,
        kind: s.kind as any,
        action: s.action as ActionStep | undefined,
        media: s.media,
      })),
    };
  }

  // Build the run-creation input for a product research run — sources variable
  // values from the product's fields and econInputs.
  private productRunInput(
    ws: string,
    productId: string,
    product: Product,
    pipeline: PipelineDocument,
    body: RunPipelineBody,
  ): PipelineRunInput {
    const e = product.econInputs ?? ({} as NonNullable<Product['econInputs']>);
    const raw: Record<string, string> = {
      niche: product.niche ?? '',
      product: product.name ?? '',
      // aov: use the product's listed price as the selling-price proxy
      aov: product.price != null ? String(product.price) : (e.targetPrice != null ? String(e.targetPrice) : ''),
      desiredPostAdCmPct: e.desiredPostAdCmPct != null ? String(e.desiredPostAdCmPct) : '',
    };
    return {
      productId,
      workspaceId: ws,
      pipelineId: pipeline._id.toString(),
      pipelineName: pipeline.name,
      projectVariables: {},
      note: product.name ?? pipeline.description ?? '',
      // Product values must WIN over the research template's empty custom-var
      // defaults (niche/product default ''), so apply them in the custom-variable
      // layer — createForPipeline applies `variables` AFTER projectVariables.
      // Run-time body.variables still override the product's values.
      variables: mergeCustomVars(pipeline.variables, {
        ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== '')),
        ...(body.variables ?? {}),
      }),
      collections: body.collections,
      steps: pipeline.steps.map((s) => ({
        id: s.id,
        name: s.name,
        promptId: s.promptId,
        promptOverride: s.promptOverride,
        review: s.review,
        provider: s.provider,
        model: s.model,
        mode: s.mode,
        fanOut: s.fanOut,
        condition: s.condition as StepCondition | undefined,
        kind: s.kind as any,
        action: s.action as ActionStep | undefined,
        media: s.media,
      })),
    };
  }

  // Create a run by executing a composable pipeline in a task's context. The
  // pipeline must be one the task carries.
  @Post('projects/:id/tasks/:taskId/pipelines/:pipelineId/runs')
  @UseGuards(ProjectAccessGuard)
  @RequireCreate()
  async createFromPipeline(
    @CurrentProject() project: ProjectDocument,
    @Param('taskId') taskId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() body: RunPipelineBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    const task = await this.taskOnProject(project, taskId);
    if (!task.pipelines.includes(pipelineId)) {
      throw new NotFoundException('Pipeline is not on this task');
    }
    const pipeline = await this.pipelines.findActiveById(pipelineId);
    if (!pipeline || pipeline.workspaceId !== project.workspaceId) {
      throw new NotFoundException('Pipeline not found');
    }
    let copy: Product | undefined;
    if (body.productId) {
      copy = await this.products.get(body.productId, project.workspaceId);
      if (copy.projectId !== project._id.toString()) {
        throw new NotFoundException('Product not on this project');
      }
    }
    const run = await this.runs.createForPipeline(
      this.projectRunInput(project, task, pipeline, body, copy),
      user.id,
    );
    return this.runs.toView(run);
  }

  // Composition: launch every pipeline on this task at once — one run each, seeded
  // with the project's context, executed through to its first gate / completion.
  @Post('projects/:id/tasks/:taskId/runs/all')
  @UseGuards(ProjectAccessGuard)
  @RequireCreate()
  async createForAllPipelines(
    @CurrentProject() project: ProjectDocument,
    @Param('taskId') taskId: string,
    @Body() body: RunPipelineBody,
    @CurrentUser() user: User,
  ): Promise<RunModel[]> {
    const task = await this.taskOnProject(project, taskId);
    const out: RunModel[] = [];
    for (const pipelineId of task.pipelines ?? []) {
      const pipeline = await this.pipelines.findActiveById(pipelineId);
      if (!pipeline || pipeline.workspaceId !== project.workspaceId || pipeline.steps.length === 0) {
        continue; // skip dangling / cross-workspace / empty pipelines
      }
      const runDoc = await this.runs.createForPipeline(
        this.projectRunInput(project, task, pipeline, body),
        user.id,
      );
      out.push(await this.runs.runAll(runDoc, user.id));
    }
    return out;
  }

  // Test-run a pipeline from the builder — no project. {note} is filled from the
  // pipeline's note; {product}/{niche}/{homepage} stay blank (no project).
  @Post('workspaces/:id/pipelines/:pipelineId/test-runs')
  @UseGuards(WorkspaceGuard)
  @RequireCreate()
  async createTestRun(
    @Param('id') workspaceId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() body: RunPipelineBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    const pipeline = await this.pipelines.findActiveById(pipelineId);
    if (!pipeline || pipeline.workspaceId !== workspaceId) {
      throw new NotFoundException('Pipeline not found');
    }
    const run = await this.runs.createForPipeline(
      {
        workspaceId,
        pipelineId: pipeline._id.toString(),
        pipelineName: pipeline.name,
        projectVariables: {},
        note: pipeline.description ?? '',
        variables: mergeCustomVars(pipeline.variables, body.variables),
        collections: body.collections,
        steps: pipeline.steps.map((s) => ({
          id: s.id,
          name: s.name,
          promptId: s.promptId,
          promptOverride: s.promptOverride,
          review: s.review,
          provider: s.provider,
          model: s.model,
          mode: s.mode,
          fanOut: s.fanOut,
          condition: s.condition as StepCondition | undefined,
          kind: s.kind as any,
          action: s.action as ActionStep | undefined,
          media: s.media,
        })),
      },
      user.id,
    );
    return this.runs.toView(run);
  }

  @Post('workspaces/:id/products/:productId/runs')
  @UseGuards(WorkspaceGuard)
  @RequireCreate()
  async createProductRun(
    @Param('id') ws: string,
    @Param('productId') productId: string,
    @Body() body: RunPipelineBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    const product = await this.products.get(productId, ws);
    const pipeline = await this.research.seedDoc(ws, user.id);
    const run = await this.runs.createForPipeline(this.productRunInput(ws, productId, product, pipeline, body), user.id);
    return this.runs.toView(run);
  }

  @Get('workspaces/:id/products/:productId/runs')
  @UseGuards(WorkspaceGuard)
  async listProductRuns(@Param('id') ws: string, @Param('productId') productId: string): Promise<RunModel[]> {
    return this.runs.toViews(await this.runs.listForProduct(productId, ws));
  }

  @Get('projects/:id/tasks/:taskId/runs')
  @UseGuards(ProjectAccessGuard)
  async list(
    @CurrentProject() project: ProjectDocument,
    @Param('taskId') taskId: string,
  ): Promise<RunModel[]> {
    const task = await this.taskOnProject(project, taskId);
    return this.runs.toViews(await this.runs.listForTask(task._id.toString()));
  }

  @Get('runs/:id')
  @UseGuards(RunAccessGuard)
  get(@CurrentRun() run: RunDocument): Promise<RunModel> {
    return this.runs.toView(run);
  }

  // Media produced by this run's steps (images/video). Same access as the run.
  @Get('runs/:id/assets')
  @UseGuards(RunAccessGuard)
  async runAssets(@CurrentRun() run: RunDocument): Promise<AssetModel[]> {
    return this.assets.toViews(await this.assets.listForRun(run._id.toString()));
  }

  // Download a step's assets as a single zip. `?step=i` scopes to one step;
  // omit it to bundle the whole run. The api fetches each (possibly cross-origin)
  // asset server-side and streams a zip — the browser can't do this for external
  // URLs (CORS) and a plain link wouldn't carry auth. Registered before the
  // single-asset route so `assets/zip` never matches `:assetId`.
  @Get('runs/:id/assets/zip')
  @UseGuards(RunAccessGuard)
  async downloadZip(
    @CurrentRun() run: RunDocument,
    @Query('step') step: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const all = this.assets.toViews(await this.assets.listForRun(run._id.toString()));
    const scoped =
      step !== undefined && step !== ''
        ? all.filter((a) => a.stepIndex === Number(step))
        : all;
    const base =
      step !== undefined && step !== '' ? `step-${Number(step) + 1}-assets` : 'run-assets';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.zip"`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err) => res.destroy(err));
    archive.pipe(res);

    const used = new Set<string>();
    for (const a of scoped) {
      try {
        const up = await fetch(a.url);
        if (!up.ok || !up.body) continue;
        const name = uniqueName(assetFilename(a, up.headers.get('content-type')), used);
        archive.append(Readable.fromWeb(up.body as WebReadableStream), { name });
      } catch {
        // skip an unreachable asset — a partial zip beats a failed download
      }
    }
    await archive.finalize();
  }

  // Download a single asset as an attachment (forces a save with a real
  // filename + extension; the api proxies the cross-origin fetch).
  @Get('runs/:id/assets/:assetId/download')
  @UseGuards(RunAccessGuard)
  async downloadAsset(
    @CurrentRun() run: RunDocument,
    @Param('assetId') assetId: string,
    @Res() res: Response,
  ): Promise<void> {
    const all = this.assets.toViews(await this.assets.listForRun(run._id.toString()));
    const asset = all.find((a) => a.id === assetId);
    if (!asset) throw new NotFoundException('Asset not found');

    const up = await fetch(asset.url);
    if (!up.ok || !up.body) throw new NotFoundException('Asset source unavailable');

    const contentType = up.headers.get('content-type');
    res.setHeader('Content-Type', contentType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${assetFilename(asset, contentType)}"`,
    );
    const len = up.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    Readable.fromWeb(up.body as WebReadableStream).pipe(res);
  }

  @Patch('runs/:id/steps/:i/prompt')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  setPrompt(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @Body() body: UpdatePromptBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.updatePrompt(run, i, body.prompt, user.id);
  }

  // Promote a run step's prompt to its originating pipeline step as an override.
  // Uses the run's provenance (pipelineStepId) — not client input — so the target
  // is always server-authoritative and workspace-fenced.
  @Post('runs/:id/steps/:i/save-to-pipeline')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  saveStepToPipeline(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @CurrentUser() user: User,
  ) {
    return this.runs.saveStepToPipeline(run, i, user.id);
  }

  @Patch('runs/:id/rating')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  rate(
    @CurrentRun() run: RunDocument,
    @Body() body: RateRunBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.rate(run, body.value, user.id);
  }

  @Post('runs/:id/steps/:i/run')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  runStep(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @CurrentUser() user: User,
    @Body() body: RunStepBody,
  ): Promise<RunModel> {
    return this.runs.runStep(run, i, user.id, body?.bypassCache ?? false);
  }

  @Post('runs/:id/actions/image')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  imageAction(
    @CurrentRun() run: RunDocument,
    @Body() body: ImageActionBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.appendImageAction(run, body, user.id);
  }

  @Post('runs/:id/steps/:i/approve')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  approve(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.approveGate(run, i, user.id);
  }

  @Post('runs/:id/steps/:i/reject')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  reject(
    @CurrentRun() run: RunDocument,
    @Param('i', ParseIntPipe) i: number,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.rejectGate(run, i, user.id);
  }

  @Post('runs/:id/run-all')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  runAll(@CurrentRun() run: RunDocument, @CurrentUser() user: User): Promise<RunModel> {
    return this.runs.runAll(run, user.id);
  }

  @Post('runs/:id/stop')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  stop(@CurrentRun() run: RunDocument, @CurrentUser() user: User): Promise<RunModel> {
    return this.runs.stop(run, user.id);
  }

  @Post('runs/:id/reset')
  @UseGuards(RunAccessGuard)
  @RequireCreate()
  reset(@CurrentRun() run: RunDocument, @CurrentUser() user: User): Promise<RunModel> {
    return this.runs.reset(run, user.id);
  }
}

// ---- download helpers -----------------------------------------------------

// A safe download filename for an asset: prefer the original name from the URL
// (e.g. `cozyclaw-main-hero.png`), else synthesise `step-<n>-<id>.<ext>`.
function assetFilename(asset: AssetModel, contentType?: string | null): string {
  try {
    const seg = new URL(asset.url).pathname.split('/').filter(Boolean).pop();
    if (seg && /\.[a-z0-9]{2,4}$/i.test(seg)) {
      return decodeURIComponent(seg).replace(/[/\\]/g, '_');
    }
  } catch {
    // asset.url isn't a parseable URL — fall through to a synthesised name
  }
  return `step-${asset.stepIndex + 1}-${asset.id}.${extFor(asset.type, contentType)}`;
}

function extFor(type: string, contentType?: string | null): string {
  if (contentType) {
    const sub = contentType.split(';')[0].trim().split('/')[1];
    if (sub) return sub === 'jpeg' ? 'jpg' : sub;
  }
  return type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'png';
}

// Keep zip entry names unique (two assets can share a filename).
function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (used.has(candidate)) candidate = `${stem}-${++n}${ext}`;
  used.add(candidate);
  return candidate;
}
