import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ServerResponse } from 'http';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

// Fastify's decorated reply (has .code()/.send()) — present in normal route handlers.
interface FastifyLikeReply {
  code: (statusCode: number) => { send: (body: unknown) => void };
}

// The raw Node response — what we get if an exception is ever thrown from Express-compat
// middleware (registered via @fastify/middie), since that layer doesn't hand the exception
// filter a fully Fastify-decorated reply. Kept defensive even though the app currently has
// no NestMiddleware left (AES decryption now runs as a Guard, which does get a real reply).
function isFastifyLikeReply(res: unknown): res is FastifyLikeReply {
  return !!res && typeof (res as FastifyLikeReply).code === 'function';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyLikeReply | ServerResponse>();
    const request = ctx.getRequest<{ method: string; url: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (isHttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error = (body.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${Array.isArray(message) ? message.join(', ') : message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (isFastifyLikeReply(response)) {
      void response.code(status).send(body);
    } else {
      const rawResponse = response as ServerResponse;
      rawResponse.statusCode = status;
      rawResponse.setHeader('Content-Type', 'application/json');
      rawResponse.end(JSON.stringify(body));
    }
  }
}
