import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseMeta {
  page?: number;
  total?: number;
  [key: string]: unknown;
}

export interface TransformedResponse<T> {
  data: T;
  meta?: ResponseMeta;
}

interface ShapedPayload<T> {
  data: T;
  meta?: ResponseMeta;
}

function hasDataShape<T>(payload: unknown): payload is ShapedPayload<T> {
  return typeof payload === 'object' && payload !== null && 'data' in payload;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, TransformedResponse<T>> {
  public intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<TransformedResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (hasDataShape<T>(payload)) {
          return { data: payload.data, meta: payload.meta };
        }
        return { data: payload };
      }),
    );
  }
}
