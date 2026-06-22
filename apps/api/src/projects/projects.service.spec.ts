import { ProjectStatus, ProjectShare } from '@lyra/shared';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  describe('findByIdAndUpdate', () => {
    it('should persist brandKit on update', async () => {
      // Arrange: mock models and service
      const projectId = 'p1';
      const workspaceId = 'ws1';
      const brandKit = { logoUrl: 'https://x/logo.png' };

      const mockProject = {
        _id: { toString: () => projectId },
        workspaceId,
        name: 'Test Project',
        description: '',
        status: ProjectStatus.Draft,
        shared: ProjectShare.All,
        sharedWith: [],
        channels: [],
        variables: [],
        brandKit: undefined,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'u1',
        updatedBy: 'u1',
      };

      const updatedProject = { ...mockProject, brandKit };

      const projectModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedProject),
        }),
      };

      const taskModel = {};
      const usersService = {};

      const service = new ProjectsService(projectModel as any, taskModel as any, usersService as any);

      // Act: update project with brandKit
      const result = await service.findByIdAndUpdate(projectId, { brandKit, updatedBy: 'u1' });

      // Assert: brandKit should be persisted
      expect(result).toEqual(updatedProject);
      expect(result?.brandKit).toEqual(brandKit);
      expect(result?.brandKit?.logoUrl).toBe('https://x/logo.png');
    });
  });
});
