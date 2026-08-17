import { expect, test } from '@playwright/test';
import {
  DEMO,
  channelHeading,
  expectNoHorizontalScroll,
  isMobileViewport,
  login,
  openChannel,
  sendMessage,
  uniqueText,
} from './helpers';

test.describe('TetherChat', () => {
  test('signs in and opens a channel', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    await expect(page.getByText('Wanna watch the next episode?')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('sends a message and shows it in history', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');
    await sendMessage(page, uniqueText('hello from playwright'));
  });

  test('replies to a message', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    const original = uniqueText('reply target');
    await sendMessage(page, original);
    await openMessageActions(page, original);

    await messageAction(page, 'Reply').click();
    await expect(page.getByText('Replying to')).toBeVisible();

    const answer = uniqueText('the reply itself');
    await sendMessage(page, answer);
    await expect(page.getByText('Replying to')).toBeHidden();
  });

  test('edits and deletes its own message', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    const original = uniqueText('edit me');
    await sendMessage(page, original);

    await openMessageActions(page, original);
    await messageAction(page, 'Edit').click();

    const editor = page.locator('textarea').first();
    const edited = `${original} (edited text)`;
    await editor.fill(edited);
    await editor.press('Enter');

    await expect(page.getByText(edited, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('(edited)').first()).toBeVisible();

    await openMessageActions(page, edited);
    await messageAction(page, 'Delete').click();
    await expect(page.getByText(edited, { exact: true })).toBeHidden({ timeout: 15_000 });
  });

  test('reacts to a message', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    const text = uniqueText('react to me');
    await sendMessage(page, text);
    await openMessageActions(page, text);

    if (isMobileViewport(page)) {
      await expect(page.getByRole('button', { name: 'Copy text' })).toBeVisible();
      await page.getByRole('button', { name: 'React with 👍' }).click();
      await expect(page.getByRole('button', { name: /reacted with 👍/ }).first()).toBeVisible({
        timeout: 15_000,
      });
    } else {
      // The quick-reaction row is mobile-only, so on desktop we assert the
      // emoji-mart picker mounts and closes again.
      await page.getByRole('button', { name: 'Add reaction' }).first().click();
      await expect(page.locator('em-emoji-picker')).toBeVisible({ timeout: 20_000 });
      await page.keyboard.press('Escape');
      await expect(page.locator('em-emoji-picker')).toBeHidden();
    }
  });

  test('shows realtime messages from another member', async ({ page, browser }) => {
    await login(page);
    await openChannel(page, 'chat');

    const other = await browser.newContext({
      viewport: page.viewportSize() ?? undefined,
      hasTouch: isMobileViewport(page),
      isMobile: isMobileViewport(page),
    });
    const otherPage = await other.newPage();
    await login(otherPage, DEMO.peer);
    await openChannel(otherPage, 'chat');

    const text = uniqueText('realtime ping');
    await sendMessage(otherPage, text);

    await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await other.close();
  });

  test('searches the channel history', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('textbox', { name: 'Search messages' }).fill('cliffhanger');

    await expect(page.getByText(/cliffhanger/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('opens a member profile and starts a direct message', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    if (isMobileViewport(page)) {
      await page.getByRole('button', { name: /member list/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible();
      await page.getByRole('button', { name: /^Wumpus/ }).first().click();
    } else {
      await page.getByRole('button', { name: 'Open Wumpus profile' }).first().click();
    }

    await expect(page.getByText('@wumpus').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Send a direct message' }).click();
    await expect(page).toHaveURL(/\/channels\/@me\//, { timeout: 20_000 });
  });
});

test.describe('desktop layout', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'desktop only');

  test('renders four columns and toggles the member list', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    const rail = page.getByRole('navigation', { name: 'Servers' });
    const members = page.getByRole('complementary', { name: 'Members' });

    await expect(rail).toBeVisible();
    await expect(members).toBeVisible();

    // The rail is exactly 72px and the member column 240px, like the reference.
    expect((await rail.boundingBox())?.width).toBeCloseTo(72, 0);
    expect((await members.boundingBox())?.width).toBeCloseTo(240, 0);

    await page.getByRole('button', { name: 'Hide member list' }).click();
    await expect(members).toBeHidden();

    await page.getByRole('button', { name: 'Show member list' }).click();
    await expect(members).toBeVisible();
  });

  test('reveals the hover action toolbar on a message', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    // Hover a message we just sent: history is virtualized, so older rows may
    // not be mounted.
    const text = uniqueText('hover me');
    await sendMessage(page, text);
    await page.getByText(text, { exact: true }).last().hover();

    await expect(page.getByRole('button', { name: 'Reply', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  });

  test('sends with Enter and inserts a newline with Shift+Enter', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    const composer = page.getByRole('textbox', { name: /^Message / });
    await composer.click();
    await composer.type('first line');
    await composer.press('Shift+Enter');
    await composer.type('second line');

    await expect(composer).toHaveValue('first line\nsecond line');
    await composer.press('Enter');
    await expect(composer).toHaveValue('');
  });
});

test.describe('mobile layout', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 9999) >= 768, 'mobile only');

  test('lands on direct messages and walks the panel stack', async ({ page }) => {
    await login(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Direct Messages' }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Back' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'TetherChat' })).toBeVisible();

    await page.getByRole('button', { name: 'Friendos', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Friendos' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'chat', exact: true }).click();
    await expect(channelHeading(page, 'chat')).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Once the slide transition settles only the chat panel remains mounted.
    await expect(page.getByRole('heading', { level: 1, name: 'Friendos' })).toBeHidden();

    await page.getByRole('button', { name: 'Back' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Friendos' })).toBeVisible();
  });

  test('keeps tap targets at or above 44px', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Back' }).first().click();
    await page.getByRole('button', { name: 'Friendos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Friendos' })).toBeVisible();

    for (const name of ['chat', 'announcements']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const back = await page.getByRole('button', { name: 'Back' }).first().boundingBox();
    expect(back?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(back?.width ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('shows an explicit send button and does not send on Enter', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    const composer = page.getByRole('textbox', { name: /^Message / });
    await composer.click();
    await composer.type('line one');
    await composer.press('Enter');

    // Enter must insert a newline on touch, where Shift+Enter is not available.
    await expect(composer).toHaveValue('line one\n');

    const text = uniqueText('sent with the button');
    await composer.fill(text);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('opens the members screen from the chat header', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    await page.getByRole('button', { name: /member list/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible();
  });

  test('opens message actions with a long press', async ({ page }) => {
    await login(page);
    await openChannel(page, 'chat');

    const text = uniqueText('long press me');
    await sendMessage(page, text);
    await openMessageActions(page, text);

    await expect(page.getByRole('button', { name: 'Copy text' })).toBeVisible();
  });
});

/** The hover toolbar and the mobile sheet label the same actions differently. */
const SHEET_LABELS = { Reply: 'Reply', Edit: 'Edit message', Delete: 'Delete message' } as const;

function messageAction(
  page: import('@playwright/test').Page,
  action: keyof typeof SHEET_LABELS,
) {
  const name = isMobileViewport(page) ? SHEET_LABELS[action] : action;
  return page.getByRole('button', { name, exact: true }).first();
}

/** Hover on pointer devices, long-press on touch — one helper for both. */
async function openMessageActions(page: import('@playwright/test').Page, text: string) {
  const message = page.getByText(text, { exact: true }).last();
  await message.scrollIntoViewIfNeeded();

  if (!isMobileViewport(page)) {
    await message.hover();
    return;
  }

  const box = await message.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + Math.min(20, box!.width / 2);
  const y = box!.y + box!.height / 2;

  await message.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y });
  await page.waitForTimeout(650);
  await message.dispatchEvent('pointerup', { pointerType: 'touch', clientX: x, clientY: y });
}
