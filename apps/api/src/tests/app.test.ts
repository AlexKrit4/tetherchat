import { afterAll, describe, expect, it } from 'vitest';
import { ANDROID_RELEASE } from '../androidRelease.js';
import { ANDROID_RELEASE_HISTORY, APP_CREATOR } from '../androidReleaseHistory.js';
import { closeTestApp, testApp } from './harness.js';

afterAll(async () => {
  await closeTestApp();
});

describe('android app version', () => {
  it('advertises the current APK so old clients can offer an update', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/api/app/android' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ANDROID_RELEASE);
    expect(ANDROID_RELEASE.versionCode).toBeGreaterThan(0);
    expect(ANDROID_RELEASE.url).toContain('tetherchat.apk');
  });

  it('advertises version history for the About screen', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/api/app/android/history' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ creator: APP_CREATOR, history: ANDROID_RELEASE_HISTORY });
    expect(ANDROID_RELEASE_HISTORY[0]?.versionCode).toBe(ANDROID_RELEASE.versionCode);
  });

  it('does not echo the missing route in 404 bodies', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/api/no-such-route' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'not_found', message: 'Not found' });
  });
});
