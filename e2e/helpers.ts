import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const DEMO = {
  owner: { login: 'hoods', password: 'tetherchat' },
  peer: { login: 'wumpus', password: 'tetherchat' },
};

export async function login(page: Page, account = DEMO.owner): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Email или имя пользователя|Email or username/).fill(account.login);
  await page.getByLabel(/^(Пароль|Password)/).fill(account.password);
  await page.getByRole('button', { name: /^(Войти|Log In)$/ }).click();
  await expect(page).toHaveURL(/\/channels\//, { timeout: 20_000 });
}

export function channelHeading(page: Page, channel: string) {
  return page.getByRole('heading', { level: 1, name: channel, exact: true });
}

export function isMobileViewport(page: Page): boolean {
  const size = page.viewportSize();
  return (size?.width ?? 1440) < 768;
}

export async function openChannel(page: Page, channel = 'chat'): Promise<void> {
  if (isMobileViewport(page)) {
    const back = page.getByRole('button', { name: /^(Назад|Back)$/ });
    if (await back.count()) await back.first().click();
    await expect(page.getByRole('heading', { name: 'TetherChat' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Friendos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Friendos' })).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Friendos', exact: true }).click();
  }

  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(channelHeading(page, channel)).toBeVisible({ timeout: 15_000 });
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  const composer = page.getByRole('textbox', { name: /^(Написать |Message )/ });
  await composer.click();
  await composer.fill(text);

  if (isMobileViewport(page)) {
    await page.getByRole('button', { name: /^(Отправить сообщение|Send message)$/ }).click();
  } else {
    await composer.press('Enter');
  }

  await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

export function uniqueText(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}
