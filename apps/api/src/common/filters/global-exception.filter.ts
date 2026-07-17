import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res['message'] as string) ?? exception.message;
        if (Array.isArray(res['message'])) {
          details = res['message'] as unknown[];
          message = 'Validation failed';
        }
      }

      code = this.httpStatusToCode(status);

      this.logger.warn(
        `HTTP Exception [${status}] ${request.method} ${path}: ${message}`,
      );
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError
    ) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          code = 'CONFLICT';
          message = 'A record with this value already exists';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'The requested record was not found';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          code = 'DATABASE_ERROR';
          message = 'A database error occurred';
      }

      this.logger.error(
        `Prisma Error [${exception.code}] ${request.method} ${path}: ${exception.message}`,
        exception.stack,
      );
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled Error ${request.method} ${path}: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unknown exception at ${request.method} ${path}`,
        String(exception),
      );
    }

    const body: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details: details.length > 0 ? details : undefined,
      },
      timestamp,
      path,
    };

    response.status(status).json(body);
  }

  private httpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'HTTP_ERROR';
  }
}
