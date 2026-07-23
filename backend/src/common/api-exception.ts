import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus,
    readonly requestId?: string,
  ) {
    super({ code, message }, status);
  }
}

export function badRequest(code: string, message: string): never {
  throw new ApiException(code, message, HttpStatus.BAD_REQUEST);
}

export function serviceUnavailable(code: string, message: string): never {
  throw new ApiException(code, message, HttpStatus.SERVICE_UNAVAILABLE);
}
