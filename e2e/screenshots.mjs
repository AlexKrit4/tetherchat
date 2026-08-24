/**
 * Captures the app at desktop, tablet and phone widths for visual review.
 * Usage: node e2e/screenshots.mjs [outputDir]
 */
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const outDir = process.argv[2] ?? '/tmp/tetherchat-shots';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.info(`captured ${name}`);
}

async function login(page) {
  await page.goto(`${WEB_URL}/login`);
  await page.getByLabel(/Email or username/).fill('hoods');
  await page.getByLabel(/^Password/).fill('tetherchat');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/channels\//, { timeout: 30_000 });
}

function watch(page, tag) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[${tag}] console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`[${tag}] pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`[${tag}] http ${response.status()} ${response.url()}`);
  });
}

async function checkHorizontalScroll(page, tag) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (result.scrollWidth > result.clientWidth + 1) {
    errors.push(`[${tag}] horizontal overflow: ${result.scrollWidth} > ${result.clientWidth}`);
  }
}

// --- desktop -----------------------------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, 'desktop');

  await page.goto(`${WEB_URL}/login`);
  await shot(page, '01-desktop-login');

  await login(page);
  await page.waitForTimeout(1200);
  await shot(page, '02-desktop-dms');

  await page.getByRole('button', { name: 'Friendos', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'chat', exact: true }).click();
  await page.waitForTimeout(1800);
  await shot(page, '03-desktop-channel');
  await checkHorizontalScroll(page, 'desktop');

  const message = page.getByText('Wanna watch the next episode?').first();
  if (await message.count()) {
    await message.hover();
    await page.waitForTimeout(400);
    await shot(page, '04-desktop-hover-actions');
  }

  const composer = page.getByRole('textbox', { name: /^Message / });
  await composer.click();
  await composer.fill('desktop smoke test message');
  await composer.press('Enter');
  await page.waitForTimeout(1500);
  await shot(page, '05-desktop-after-send');

  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'Search messages' }).fill('cliffhanger');
  await page.waitForTimeout(1500);
  await shot(page, '06-desktop-search');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'User settings' }).click();
  await page.waitForTimeout(700);
  await shot(page, '07-desktop-settings');
  await page.keyboard.press('Escape');

  await context.close();
}

// --- tablet ------------------------------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await context.newPage();
  watch(page, 'tablet');

  await login(page);
  await page.getByRole('button', { name: 'Friendos', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'chat', exact: true }).click();
  await page.waitForTimeout(1800);
  await shot(page, '10-tablet-channel');
  await checkHorizontalScroll(page, 'tablet');

  const membersToggle = page.getByRole('button', { name: /member list/ });
  if (await membersToggle.count()) {
    await membersToggle.first().click();
    await page.waitForTimeout(700);
    await shot(page, '11-tablet-members-overlay');
  }

  await context.close();
}

// --- phone -------------------------------------------------------------------
{
  const context = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await context.newPage();
  watch(page, 'mobile');

  await page.goto(`${WEB_URL}/login`);
  await shot(page, '20-mobile-login');

  await login(page);
  await page.waitForTimeout(1500);
  await shot(page, '21-mobile-dms');
  const backToServers = page.getByRole('button', { name: 'Back' });
  if (await backToServers.count()) await backToServers.first().click();
  await page.waitForTimeout(900);
  await shot(page, '21b-mobile-servers');
  await checkHorizontalScroll(page, 'mobile');

  await page.getByRole('button', { name: /^Friendos/ }).click();
  await page.waitForTimeout(1200);
  await shot(page, '22-mobile-channels');
  await checkHorizontalScroll(page, 'mobile');

  await page.getByRole('button', { name: 'chat', exact: true }).click();
  await page.waitForTimeout(1800);
  await shot(page, '23-mobile-chat');
  await checkHorizontalScroll(page, 'mobile');

  const composer = page.getByRole('textbox', { name: /^Message / });
  await composer.click();
  await composer.fill('mobile smoke test message');
  await page.waitForTimeout(400);
  await shot(page, '24-mobile-composer');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForTimeout(1500);
  await shot(page, '25-mobile-after-send');

  const membersButton = page.getByRole('button', { name: /member list/ });
  if (await membersButton.count()) {
    await membersButton.first().click();
    await page.waitForTimeout(900);
    await shot(page, '26-mobile-members');
    const back = page.getByRole('button', { name: 'Back' });
    if (await back.count()) await back.first().click();
    await page.waitForTimeout(700);
  }

  const settings = page.getByRole('button', { name: 'User settings' });
  if (await settings.count()) {
    await settings.first().click();
    await page.waitForTimeout(900);
    await shot(page, '27-mobile-settings');
  }

  await context.close();
}

await browser.close();

if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s) detected:`);
  for (const entry of [...new Set(errors)]) console.error(`  - ${entry}`);
} else {
  console.info('\nNo console errors, failed requests or horizontal overflow detected.');
}
