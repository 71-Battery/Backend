import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { ApiException } from './api-exception';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId =
      exception instanceof ApiException && exception.requestId
        ? exception.requestId
        : randomUUID();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        status: 'ERROR',
        error: {
          code: exception.code,
          message: exception.message,
          requestId,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const rawMessage =
        typeof exceptionResponse === 'object' && exceptionResponse
          ? (exceptionResponse as { message?: unknown }).message
          : undefined;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : status === HttpStatus.UNAUTHORIZED
            ? '인증이 필요합니다.'
            : '요청을 처리할 수 없습니다.';

      response.status(status).json({
        status: 'ERROR',
        error: {
          code:
            status === HttpStatus.UNAUTHORIZED
              ? 'AUTH_REQUIRED'
              : status === HttpStatus.FORBIDDEN
                ? 'FORBIDDEN'
                : 'REQUEST_FAILED',
          message,
          requestId,
        },
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: 'ERROR',
      error: {
        code: 'INTERNAL_ERROR',
        message: '요청 처리 중 문제가 발생했습니다.',
        requestId,
      },
    });
  }
}
