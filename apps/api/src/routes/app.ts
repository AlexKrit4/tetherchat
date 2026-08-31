import type { FastifyInstance } from 'fastify';
import { ANDROID_RELEASE } from '../androidRelease.js';
<<<<<<< HEAD
import { ANDROID_RELEASE_HISTORY, APP_CREATOR } from '../androidReleaseHistory.js';
=======
import { INSTALL_DOWNLOADS } from '../installDownloads.js';
>>>>>>> origin/cursor/desktop-app-8132

export async function appRoutes(app: FastifyInstance) {
  /** Public Android APK version so old clients can offer an in-app update. */
  app.get('/android', async () => ANDROID_RELEASE);

<<<<<<< HEAD
  /** Version history for the About screen in clients. */
  app.get('/android/history', async () => ({
    creator: APP_CREATOR,
    history: ANDROID_RELEASE_HISTORY,
  }));
=======
  /** Install links for Android, Windows and Linux clients. */
  app.get('/install', async () => INSTALL_DOWNLOADS);
>>>>>>> origin/cursor/desktop-app-8132
}
