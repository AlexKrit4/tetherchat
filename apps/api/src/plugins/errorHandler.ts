import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError, isApiError } from '../errors.js';
import type { ApiErrorBody } from '@tetherchat/shared';

export const errorHandlerPlugin = fp(async (app) => {
  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = {
      code: 'not_found',
      message: `Route ${request.method} ${request.url} not found`,
    };
    reply.status(404).send(body);
  });

  app.setErrorHandler((error, request, reply) => {
    if (isApiError(error)) {
      const body: ApiErrorBody = { code: error.code, message: error.message };
      if (error.details !== undefined) body.details = error.details;
      reply.status(error.statusCode).send(body);
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        code: 'validation_error',
        message: 'Тело запроса некорректно',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      } satisfies ApiErrorBody);
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        reply.status(409).send({
          code: 'conflict',
          message: 'Запрос с такими данными уже существует',
        } satisfies ApiErrorBody);
        return;
      }
      if (error.code === 'P2025') {
        reply.status(404).send({ code: 'not_found', message: 'Не найдено' } satisfies ApiErrorBody);
        return;
      }
    }

    const raw = error as { statusCode?: number; message?: string };
    const statusCode = raw.statusCode;
    if (statusCode === 429) {
      reply.status(429).send({
        code: 'rate_limited',
        message: 'Слишком много запросов, подождите',
      } satisfies ApiErrorBody);
      return;
    }
    if (statusCode === 413) {
      reply.status(413).send({
        code: 'payload_too_large',
        message: 'Файл слишком большой',
      } satisfies ApiErrorBody);
      return;
    }
    if (statusCode && statusCode < 500) {
      reply.status(statusCode).send({
        code: 'bad_request',
        message: raw.message ?? 'Некорректный запрос',
      } satisfies ApiErrorBody);
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    const fallback = ApiError.internal();
    reply.status(500).send({ code: fallback.code, message: fallback.message } satisfies ApiErrorBody);
  });
});
