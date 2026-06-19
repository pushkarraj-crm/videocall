import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { BusinessException } from '../exceptions/business.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      const body = exception.getResponse() as { message: string; code?: string };
      message = body.message;
      code = body.code;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message as string) ??
            exception.message;
      if (Array.isArray(message)) {
        message = message.join(', ');
      }
    }

    if (status >= 500) {
      this.logger.error(
        { err: exception, path: request.url, requestId: request.requestId },
        'Unhandled exception',
      );
    }

    response.status(status).json({
      success: false,
      error: {
        message,
        code,
        statusCode: status,
      },
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}