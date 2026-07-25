import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';

interface HttpRequestResponse {
  req: FastifyRequest;
  res: FastifyReply;
}

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): HttpRequestResponse {
    if (context.getType<'graphql'>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context).getContext<{
        req: FastifyRequest;
        reply: FastifyReply;
      }>();
      return { req: gqlCtx.req, res: gqlCtx.reply };
    }

    const http = context.switchToHttp();
    return { req: http.getRequest(), res: http.getResponse() };
  }
}
