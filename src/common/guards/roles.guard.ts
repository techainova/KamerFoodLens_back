import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FastifyRequest } from 'fastify';
import { AppRole, ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface RequestWithUser extends FastifyRequest {
  user: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request =
      context.getType<'graphql'>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext<{ req: RequestWithUser }>().req
        : context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role privileges for this resource');
    }

    return true;
  }
}
