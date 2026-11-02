import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@sellnest/shared';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/** Every failure leaves the API as { error: { code, message, details?, requestId } }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { id?: string }>();
    const { status, body } = this.toError(exception);
    if (status >= 500) {
      // The stack goes to the log; the client only gets a generic message and request id.
      this.logger.error(`${req.method} ${req.path}: ${(exception as Error)?.message}`, (exception as Error)?.stack);
    }
    res.status(status).json({ error: { ...body, requestId: req.id?.toString() } } satisfies ApiErrorBody);
  }

  private toError(e: unknown): { status: number; body: ApiErrorBody['error'] } {
    if (e instanceof ZodValidationException) {
      const zod = e.getZodError() as ZodError;
      return {
        status: 400,
        body: {
          code: 'VALIDATION_FAILED',
          message: zod.issues[0]?.message ?? 'Check the highlighted fields',
          details: zod.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const response = e.getResponse();
      const obj = typeof response === 'object' ? (response as { code?: string; message?: string | string[] }) : {};
      const message = Array.isArray(obj.message) ? obj.message[0] : (obj.message ?? e.message);
      return { status, body: { code: obj.code ?? CODE_BY_STATUS[status] ?? 'ERROR', message: message ?? 'Request failed' } };
    }
    if (e instanceof MulterError) {
      const tooLarge = e.code === 'LIMIT_FILE_SIZE';
      return {
        status: tooLarge ? 413 : 400,
        body: {
          code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
          message: tooLarge ? 'That file is too large' : 'The upload could not be read',
        },
      };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return { status: 409, body: { code: 'CONFLICT', message: 'That already exists' } };
      if (e.code === 'P2025') return { status: 404, body: { code: 'NOT_FOUND', message: 'Not found' } };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Try again.' },
    };
  }
}
