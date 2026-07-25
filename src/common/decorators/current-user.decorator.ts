import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FastifyRequest } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'standard' | 'pro' | 'admin';
}

interface RequestWithUser extends FastifyRequest {
  user: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
    const request: RequestWithUser =
      ctx.getType<'graphql'>() === 'graphql'
        ? GqlExecutionContext.create(ctx).getContext<{ req: RequestWithUser }>().req
        : ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user[data] : request.user;
  },
);
