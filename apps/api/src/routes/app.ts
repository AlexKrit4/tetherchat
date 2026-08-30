import type { FastifyInstance } from 'fastify';
import { ANDROID_RELEASE } from '../androidRelease.js';
import { ANDROID_RELEASE_HISTORY, APP_CREATOR } from '../androidReleaseHistory.js';

export async function appRoutes(app: FastifyInstance) {
  /** Public Android APK version so old clients can offer an in-app update. */
  app.get('/android', async () => ANDROID_RELEASE);

  /** Version history for the About screen in clients. */
  app.get('/android/history', async () => ({
    creator: APP_CREATOR,
    history: ANDROID_RELEASE_HISTORY,
  }));
}
