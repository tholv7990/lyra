import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Provider, StepStatus } from '@lyra/shared';
import { RunsService } from './runs.service';
import { KeysService } from '../keys/keys.service';
import { ReplicateClient } from './providers/replicate.client';
import { VideoStepProvider } from './providers/video.provider';
import type { RunDocument } from './run.schema';

const POLL_MS = Number(process.env.VIDEO_POLL_MS) || 8000;
const MAX_AGE_MS = Number(process.env.VIDEO_JOB_MAX_MS) || 15 * 60 * 1000;

// Polls in-flight async video jobs (submitted by VideoStepProvider). On a terminal
// Replicate status it completes (re-host + resume the run) or fails the step;
// otherwise it records progress. State (jobId) lives on the Step -> restart-safe.
@Injectable()
export class VideoJobPoller {
  private readonly log = new Logger('VideoJobPoller');
  private busy = false;
  constructor(
    private readonly runs: RunsService,
    private readonly keys: KeysService,
    private readonly replicate: ReplicateClient,
    private readonly video: VideoStepProvider,
  ) {}

  @Interval(POLL_MS)
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const docs = await this.runs.findInFlightAsync();
      for (const doc of docs) {
        await this.advanceOne(doc).catch((e) =>
          this.log.warn(`poll ${String(doc._id)}: ${e instanceof Error ? e.message : String(e)}`),
        );
      }
    } finally {
      this.busy = false;
    }
  }

  private async advanceOne(doc: RunDocument): Promise<void> {
    // Search doc.steps directly — jobId is a schema-only field not present on the
    // shared Step shape returned by toState/toStep, so we must look at the raw steps.
    const index = doc.steps.findIndex(
      (s) => s.status === StepStatus.Running && !!(s as { jobId?: string }).jobId,
    );
    if (index < 0) return;
    const rawStep = doc.steps[index] as { jobId?: string; model: string; startedAt?: string };
    const token = await this.keys.getDecrypted(doc.workspaceId, Provider.Video);
    if (!token) return; // no key -> cannot poll; leave for next tick / human
    const pred = await this.replicate.get(rawStep.jobId as string, token); // transient errors bubble to tick's catch
    if (pred.status === 'succeeded') {
      const output = await this.video.finalize(pred, rawStep.model);
      await this.runs.resumeAfterAsync(doc, index, output, 'system');
    } else if (pred.status === 'failed' || pred.status === 'canceled') {
      await this.runs.failAsyncStep(doc, index, `Video ${pred.status}: ${(pred.error ?? '').slice(0, 200)}`);
    } else {
      const started = rawStep.startedAt ? new Date(rawStep.startedAt).getTime() : Date.now();
      if (Date.now() - started > MAX_AGE_MS) {
        await this.runs.failAsyncStep(doc, index, 'Video generation timed out.');
      } else {
        await this.runs.updateAsyncProgress(doc, index, this.replicate.progressOf(pred));
      }
    }
  }
}
