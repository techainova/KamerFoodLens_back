import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamesService } from '../games/games.service';
import { S3UploadService } from '../../common/services/s3-upload.service';

// Regression test for the "add a dish photo upload field" request: the upload
// endpoint must reuse the same ownership check as create/update/delete, and
// must never call S3 for a restaurant the caller doesn't own.
describe('RestaurantsService.uploadMenuItemImage', () => {
  const userId = 'owner-1';
  const restaurantId = 'restaurant-1';

  function buildService(ownerId: string) {
    const prisma = {
      restaurant: {
        findUnique: jest.fn().mockResolvedValue({ id: restaurantId, ownerId }),
      },
    } as unknown as PrismaService;
    const gamesService = {} as GamesService;
    const s3UploadService = {
      uploadBase64Image: jest.fn().mockResolvedValue('https://cdn.example.com/menu-items/abc.jpg'),
    } as unknown as S3UploadService;

    return { service: new RestaurantsService(prisma, gamesService, s3UploadService), s3UploadService, prisma };
  }

  it('uploads to the "menu-items" folder and returns the URL when the caller owns the restaurant', async () => {
    const { service, s3UploadService } = buildService(userId);

    const result = await service.uploadMenuItemImage(userId, restaurantId, {
      imageBase64: 'AAAA',
      mimeType: 'image/png',
    });

    expect(s3UploadService.uploadBase64Image).toHaveBeenCalledWith('AAAA', 'image/png', 'menu-items');
    expect(result).toEqual({ url: 'https://cdn.example.com/menu-items/abc.jpg' });
  });

  it('rejects with ForbiddenException when the caller does not own the restaurant', async () => {
    const { service, s3UploadService } = buildService('someone-else');

    await expect(
      service.uploadMenuItemImage(userId, restaurantId, { imageBase64: 'AAAA', mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(s3UploadService.uploadBase64Image).not.toHaveBeenCalled();
  });

  it('rejects with NotFoundException when the restaurant does not exist', async () => {
    const prisma = { restaurant: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const s3UploadService = { uploadBase64Image: jest.fn() } as unknown as S3UploadService;
    const service = new RestaurantsService(prisma, {} as GamesService, s3UploadService);

    await expect(
      service.uploadMenuItemImage(userId, restaurantId, { imageBase64: 'AAAA', mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
