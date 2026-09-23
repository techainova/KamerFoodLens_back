import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3UploadService } from '../../common/services/s3-upload.service';

// Regression tests for this session's additions: account deactivation (the
// "delete account" button previously called no API at all) and user search
// (feeds the "new conversation" flow in messaging, which previously had no
// way to start a conversation with anyone not already messaged).
describe('UsersService', () => {
  function buildService(overrides: { userFindMany?: unknown[] } = {}) {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue(overrides.userFindMany ?? []),
      },
    } as unknown as PrismaService;

    const redis = { del: jest.fn().mockResolvedValue(1) };
    const s3UploadService = {} as S3UploadService;
    const journalModel = {} as never;
    const scanResultModel = {} as never;
    const postModel = {} as never;

    const service = new UsersService(
      prisma,
      s3UploadService,
      journalModel,
      scanResultModel,
      postModel,
      redis as never,
    );

    return { service, prisma, redis };
  }

  describe('deleteAccount', () => {
    it('deactivates the user and revokes their refresh token', async () => {
      const { service, prisma, redis } = buildService();

      const result = await service.deleteAccount('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { isActive: false } });
      expect(redis.del).toHaveBeenCalledWith('refresh_token:user-1');
      expect(result).toEqual({ message: 'Account deactivated' });
    });
  });

  describe('searchUsers', () => {
    it('returns an empty array for queries shorter than 2 characters', async () => {
      const { service, prisma } = buildService();

      const result = await service.searchUsers('user-1', 'a');

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('excludes the current user and maps results to the search view', async () => {
      const { service, prisma } = buildService({
        userFindMany: [
          { id: 'user-2', firstName: 'Marie', lastName: 'Kamga', username: 'mariek', avatar: null, role: 'standard' },
        ],
      });

      const result = await service.searchUsers('user-1', 'mar');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 'user-1' } }),
        }),
      );
      expect(result).toEqual([
        { id: 'user-2', name: 'Marie Kamga', username: 'mariek', avatar: null, role: 'standard' },
      ]);
    });
  });
});
