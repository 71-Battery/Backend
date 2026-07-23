import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { ApiException } from '../common/api-exception';

@Catch()
export class CampusChatExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId =
      exception instanceof ApiException && exception.requestId
        ? exception.requestId
        : randomUUID();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.message,
          request_id: requestId,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        error: {
          code:
            status === HttpStatus.UNAUTHORIZED
              ? 'INVALID_TOKEN'
              : 'INVALID_REQUEST',
          message:
            status === HttpStatus.UNAUTHORIZED
              ? '인증 정보가 만료되었거나 유효하지 않습니다.'
              : '요청 형식이 올바르지 않습니다.',
          request_id: requestId,
        },
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '요청 처리 중 문제가 발생했습니다.',
        request_id: requestId,
      },
    });
  }
}
