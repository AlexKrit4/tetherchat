import type { FastifyInstance } from 'fastify';
import { ANDROID_RELEASE } from '../androidRelease.js';
import { INSTALL_DOWNLOADS } from '../installDownloads.js';

export async function appRoutes(app: FastifyInstance) {
  /** Public Android APK version so old clients can offer an in-app update. */
  app.get('/android', async () => ANDROID_RELEASE);

  /** Install links for Android, Windows and Linux clients. */
  app.get('/install', async () => INSTALL_DOWNLOADS);
}
