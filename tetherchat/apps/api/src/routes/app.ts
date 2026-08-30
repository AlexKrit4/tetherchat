import type { FastifyInstance } from 'fastify';
import { ANDROID_RELEASE } from '../androidRelease.js';

export async function appRoutes(app: FastifyInstance) {
  /** Public Android APK version so old clients can offer an in-app update. */
  app.get('/android', async () => ANDROID_RELEASE);
}
