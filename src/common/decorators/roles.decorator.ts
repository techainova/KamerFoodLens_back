import { SetMetadata } from '@nestjs/common';

export type AppRole = 'standard' | 'pro' | 'admin';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: AppRole[]): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles);
