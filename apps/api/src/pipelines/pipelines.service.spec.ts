import { ActionType, StepKind } from '@lyra/shared';
import type { Corner } from '@lyra/shared';
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
        service.setStepOverride('ws-attacker', 'pl-victim', 'step-1', 'text', 'actor'),
      ).rejects.toBeInstanceOf(NotFoundException);
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
        service.setStepOverride('ws-1', 'pl-1', 'step-NONEXISTENT', 'text', 'actor'),
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

      await service.setStepOverride('ws-1', 'pl-1', 'step-1', 'Override text', 'actor-1');

      expect(fakePipeline.steps[0].promptOverride).toBe('Override text');
      expect(fakePipeline.steps[1].promptOverride).toBeUndefined(); // untouched
      expect(fakePipeline.markModified).toHaveBeenCalledWith('steps');
      expect(fakePipeline.save).toHaveBeenCalled();
      expect(fakePipeline.updatedBy).toBe('actor-1');
    });
  });
});
