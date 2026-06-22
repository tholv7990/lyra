import { ActionType, StepKind } from '@lyra/shared';
import type { Corner } from '@lyra/shared';
import { PipelinesService } from './pipelines.service';

describe('PipelinesService', () => {
  describe('normalizeSteps', () => {
    it('should preserve kind and action properties through normalization', () => {
      // Arrange: create a PipelinesService instance with minimal mocks
      const mockModel = {};
      const mockUsersService = {};
      const service = new PipelinesService(mockModel as any, mockUsersService as any);

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
  });
});
