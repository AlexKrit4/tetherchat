import { afterAll, describe, expect, it } from 'vitest';
import { ANDROID_RELEASE } from '../androidRelease.js';
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
});
