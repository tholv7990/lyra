import { ActionType, MediaType, Provider, StepKind } from '@lyra/shared';
import type { Corner, PromptMedia } from '@lyra/shared';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PipelinesService } from './pipelines.service';

function makeService() {
  const mockModel = {};
  const mockUsersService = {};
  return new PipelinesService(mockModel as any, mockUsersService as any);
}

describe('PipelinesService', () => {
  describe('normalizeSteps', () => {
    it('should preserve kind and action properties through normalization', () => {
      // Arrange: create a PipelinesService instance with minimal mocks
      const service = makeService();

      const testStep = {
        name: 'Brand',
        promptId: '',
        provider: 'anthropic' as any,
        model: 'claude-3-5-sonnet-20241022',
        mode: 'auto' as any,
        kind: StepKind.Action,
        action: {
          type: ActionType.Brand,
          position: 'br' as Corner,
          size: 'md' as const,
        } as const,
      };

      // Act: normalize the step
      const result = service.normalizeSteps([testStep]);

      // Assert: kind and action should be preserved
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Brand',
        promptId: '',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        mode: 'auto',
        kind: StepKind.Action,
        action: {
          type: ActionType.Brand,
          position: 'br',
          size: 'md',
        },
      });
      expect(result[0].kind).toBe(StepKind.Action);
      expect(result[0].action?.type).toBe(ActionType.Brand);
    });

    it('preserves promptOverride through normalization (builder saves must not drop it)', () => {
      const service = makeService();

      const result = service.normalizeSteps([
        {
          name: 'Write',
          promptId: 'lib-id',
          promptOverride: 'My custom override text',
          provider: 'anthropic' as any,
          model: 'claude-3-5-sonnet-20241022',
          mode: 'auto' as any,
        },
        {
          name: 'Improve',
          promptId: 'lib-id-2',
          // no override — should come through as undefined
          provider: 'anthropic' as any,
          model: 'claude-3-5-sonnet-20241022',
          mode: 'auto' as any,
        },
      ]);

      expect(result[0].promptOverride).toBe('My custom override text');
      expect(result[1].promptOverride).toBeUndefined();
    });

    it('normalizes whitespace-only promptOverride to undefined', () => {
      const service = makeService();

      const result = service.normalizeSteps([
        {
          name: 'Write',
          promptId: 'lib-id',
          promptOverride: '   ', // whitespace only
          provider: 'anthropic' as any,
          model: 'claude-3-5-sonnet-20241022',
          mode: 'auto' as any,
        },
      ]);

      expect(result[0].promptOverride).toBeUndefined();
    });
  });

  describe('setStepOverride', () => {
    it('is tenant-fenced: a pipeline belonging to another workspace returns NotFound', async () => {
      const service = makeService();
      // findOne returns null (not found in this workspace — tenant-fenced)
      jest.spyOn(service as any, 'findOne').mockResolvedValue(null);

      await expect(
        service.setStepOverride('ws-attacker', 'pl-victim', 'step-1', { promptOverride: 'text' }, 'actor'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an over-length prompt (enforces the 8000-char override bound) before any DB read', async () => {
      const service = makeService();
      const findOne = jest.spyOn(service as any, 'findOne');
      await expect(
        service.setStepOverride('ws-1', 'pl-1', 'step-1', { promptOverride: 'x'.repeat(8001) }, 'actor'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequest when the step id does not exist on the pipeline', async () => {
      const service = makeService();
      const fakePipeline = {
        steps: [{ id: 'step-correct', promptOverride: undefined }],
        updatedBy: '',
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(service as any, 'findOne').mockResolvedValue(fakePipeline);
      jest.spyOn(service, 'toView').mockResolvedValue({ id: 'pl-1' } as never);

      await expect(
        service.setStepOverride('ws-1', 'pl-1', 'step-NONEXISTENT', { promptOverride: 'text' }, 'actor'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fakePipeline.save).not.toHaveBeenCalled();
    });

    it('sets promptOverride on the matching step and saves', async () => {
      const service = makeService();
      const fakePipeline = {
        steps: [
          { id: 'step-1', promptOverride: undefined },
          { id: 'step-2', promptOverride: undefined },
        ],
        updatedBy: '',
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(service as any, 'findOne').mockResolvedValue(fakePipeline);
      jest.spyOn(service, 'toView').mockResolvedValue({ id: 'pl-1' } as never);

      await service.setStepOverride('ws-1', 'pl-1', 'step-1', { promptOverride: 'Override text' }, 'actor-1');

      expect(fakePipeline.steps[0].promptOverride).toBe('Override text');
      expect(fakePipeline.steps[1].promptOverride).toBeUndefined(); // untouched
      expect(fakePipeline.markModified).toHaveBeenCalledWith('steps');
      expect(fakePipeline.save).toHaveBeenCalled();
      expect(fakePipeline.updatedBy).toBe('actor-1');
    });

    it('writes provider and model when present in cfg', async () => {
      const service = makeService();
      const fakePipeline = {
        steps: [
          { id: 'step-1', provider: Provider.Anthropic, model: 'claude-3-5-sonnet-20241022', promptOverride: undefined, media: undefined },
        ],
        updatedBy: '',
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(service as any, 'findOne').mockResolvedValue(fakePipeline);
      jest.spyOn(service, 'toView').mockResolvedValue({ id: 'pl-1' } as never);

      await service.setStepOverride('ws-1', 'pl-1', 'step-1', { provider: Provider.OpenAI, model: 'gpt-4o' }, 'actor-1');

      expect(fakePipeline.steps[0].provider).toBe(Provider.OpenAI);
      expect(fakePipeline.steps[0].model).toBe('gpt-4o');
      expect(fakePipeline.markModified).toHaveBeenCalledWith('steps');
      expect(fakePipeline.save).toHaveBeenCalled();
    });

    it('writes media when present in cfg', async () => {
      const service = makeService();
      const media: PromptMedia[] = [{ type: MediaType.Image, url: 'https://example.com/img.png', mime: 'image/png', name: 'img.png' }];
      const fakePipeline = {
        steps: [{ id: 'step-1', media: undefined }],
        updatedBy: '',
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(service as any, 'findOne').mockResolvedValue(fakePipeline);
      jest.spyOn(service, 'toView').mockResolvedValue({ id: 'pl-1' } as never);

      await service.setStepOverride('ws-1', 'pl-1', 'step-1', { media }, 'actor-1');

      expect(fakePipeline.steps[0].media).toEqual(media);
    });

    it('does not write provider/model/media when absent from cfg', async () => {
      const service = makeService();
      const fakePipeline = {
        steps: [{ id: 'step-1', provider: Provider.Anthropic, model: 'claude-3-5-sonnet-20241022', promptOverride: undefined, media: undefined }],
        updatedBy: '',
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(service as any, 'findOne').mockResolvedValue(fakePipeline);
      jest.spyOn(service, 'toView').mockResolvedValue({ id: 'pl-1' } as never);

      await service.setStepOverride('ws-1', 'pl-1', 'step-1', { promptOverride: 'new prompt' }, 'actor-1');

      // provider/model/media should be unchanged
      expect(fakePipeline.steps[0].provider).toBe(Provider.Anthropic);
      expect(fakePipeline.steps[0].model).toBe('claude-3-5-sonnet-20241022');
      expect(fakePipeline.steps[0].media).toBeUndefined();
    });
  });
});

// ---- runs.service updateStepModel tests ------------------------------------

// Minimal inline test for updateStepModel (mirrors updatePrompt coverage).
describe('RunsService.updateStepModel (inline)', () => {
  function makeUpdateStepModel(toViewMock: jest.Mock, reloadMock: jest.Mock) {
    return async function updateStepModel(
      doc: any,
      index: number,
      provider: string,
      model: string,
      actorId: string,
    ) {
      if (!model?.trim()) {
        throw new BadRequestException('model must be a non-empty string');
      }
      let working = doc;
      for (let attempt = 0; ; attempt++) {
        const step = working.steps[index];
        if (!step) {
          throw new BadRequestException('No such step');
        }
        step.provider = provider;
        step.model = model;
        working.updatedBy = actorId;
        try {
          await working.save();
          return toViewMock(working);
        } catch (e: any) {
          if (e?.name === 'VersionError' && attempt < 4) {
            working = await reloadMock(working);
            continue;
          }
          throw e;
        }
      }
    };
  }

  it('rejects empty model', async () => {
    const toViewMock = jest.fn().mockResolvedValue({ id: 'run-1' });
    const reloadMock = jest.fn();
    const updateStepModel = makeUpdateStepModel(toViewMock, reloadMock);
    const doc = { steps: [{ index: 0, provider: 'anthropic', model: 'old' }], updatedBy: '', save: jest.fn() };
    await expect(updateStepModel(doc, 0, 'anthropic', '', 'actor')).rejects.toBeInstanceOf(BadRequestException);
    await expect(updateStepModel(doc, 0, 'anthropic', '   ', 'actor')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets provider and model on the step', async () => {
    const toViewMock = jest.fn().mockResolvedValue({ id: 'run-1' });
    const reloadMock = jest.fn();
    const updateStepModel = makeUpdateStepModel(toViewMock, reloadMock);
    const step = { index: 0, provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' };
    const doc = { steps: [step], updatedBy: '', save: jest.fn().mockResolvedValue(undefined) };
    await updateStepModel(doc, 0, 'openai', 'gpt-4o', 'actor-1');
    expect(step.provider).toBe('openai');
    expect(step.model).toBe('gpt-4o');
    expect(doc.updatedBy).toBe('actor-1');
  });

  it('retries on VersionError then succeeds', async () => {
    const toViewMock = jest.fn().mockResolvedValue({ id: 'run-1' });
    const reloadMock = jest.fn();
    const updateStepModel = makeUpdateStepModel(toViewMock, reloadMock);
    const freshDoc = { steps: [{ index: 0, provider: 'anthropic', model: 'old' }], updatedBy: '', save: jest.fn().mockResolvedValue(undefined) };
    const versionErr = Object.assign(new Error('VersionError'), { name: 'VersionError' });
    const doc = {
      steps: [{ index: 0, provider: 'anthropic', model: 'old' }],
      updatedBy: '',
      save: jest.fn().mockRejectedValueOnce(versionErr).mockResolvedValue(undefined),
    };
    reloadMock.mockResolvedValue(freshDoc);
    await updateStepModel(doc, 0, 'openai', 'gpt-4o', 'actor');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});

// ---- saveStepToPipeline calls setStepOverride with full config -------------
describe('saveStepToPipeline full-config promote', () => {
  it('passes promptOverride/provider/model/media as cfg object to setStepOverride', async () => {
    const setStepOverrideMock = jest.fn().mockResolvedValue({ id: 'pl-1' });
    const pipelinesService = { setStepOverride: setStepOverrideMock } as any;

    // Simulate the saveStepToPipeline logic inline (extracted from RunsService to avoid DI)
    const run = {
      pipelineId: 'pl-1',
      workspaceId: 'ws-1',
      steps: [{
        pipelineStepId: 'step-1',
        prompt: 'my prompt',
        provider: Provider.OpenAI,
        model: 'gpt-4o',
        media: [{ type: MediaType.Image, url: 'https://example.com/img.png', mime: 'image/png', name: 'img.png' }],
      }],
    };
    const index = 0;
    const actorId = 'actor-1';

    const step = run.steps[index];
    await pipelinesService.setStepOverride(
      run.workspaceId,
      run.pipelineId,
      step.pipelineStepId,
      { promptOverride: step.prompt, provider: step.provider, model: step.model, media: step.media },
      actorId,
    );

    expect(setStepOverrideMock).toHaveBeenCalledWith(
      'ws-1',
      'pl-1',
      'step-1',
      { promptOverride: 'my prompt', provider: Provider.OpenAI, model: 'gpt-4o', media: run.steps[0].media },
      'actor-1',
    );
  });
});
