import { expect, test } from '@playwright/test';

async function openRetro(page) {
  await page.goto('/?retro=1');
  const reject = page.getByRole('button', { name: 'Weigeren' });
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

async function openDesktopWindow(page, label) {
  const icon = page.locator('.desktop-icon').filter({ hasText: label }).first();
  await icon.dblclick();
}

test('single click selects and double click opens a desktop application', async ({ page }) => {
  await openRetro(page);
  const icon = page.locator('#retro-computer-icon');
  await icon.click();
  await expect(icon).toHaveClass(/selected/);
  await expect(page.locator('#computer-window')).toBeHidden();
  await icon.dblclick();
  await expect(page.locator('#computer-window')).toBeVisible();
});

test('maximize changes to restore and fills the desktop work area', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Kladblok');
  const win = page.locator('#notepad-window');
  const maximize = win.locator('.max-btn');
  await maximize.click();
  await expect(win).toHaveClass(/maximized/);
  await expect(maximize).toHaveClass(/is-restore/);
  await expect(maximize).toHaveAttribute('aria-label', 'Herstellen');
  const box = await win.boundingBox();
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(box.width).toBe(1280);
  expect(box.height).toBeLessThan(800);
  await maximize.click();
  await expect(win).not.toHaveClass(/maximized/);
});

test('title bars and dialog controls match Windows 95 geometry and behavior', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Kladblok');
  const titlebar = page.locator('#notepad-window .win-titlebar');
  const control = page.locator('#notepad-window .close-btn');
  await expect(titlebar).toHaveCSS('background-color', 'rgb(0, 0, 128)');
  expect(await titlebar.evaluate((element) => element.getBoundingClientRect().height)).toBe(18);
  expect(await control.evaluate((element) => ({ width: element.offsetWidth, height: element.offsetHeight }))).toEqual({ width: 16, height: 14 });

  await page.locator('#start-btn').click();
  await page.getByText('Uitvoeren...', { exact: true }).click();
  const run = page.locator('#run-window');
  await expect(run.locator('.help-btn')).toHaveCount(1);
  await expect(run.locator('.close-btn')).toHaveCount(1);
  await expect(run.locator('.min-btn, .max-btn')).toHaveCount(0);
  await run.locator('.help-btn').click();
  await expect(run.locator('.win-context-help')).toBeVisible();
  await run.locator('.help-btn').click();
  await expect(run.locator('.win-context-help')).toHaveCount(0);
});

test('taskbar buttons include the app icon', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Paint');
  const taskButton = page.locator('.taskbar-window-btn[data-window="paint-window"]');
  await expect(taskButton).toBeVisible();
  await expect(taskButton.locator('img')).toHaveCount(1);
  await expect(taskButton).toContainText('Paint');
});

test('closing Media Player stops its iframe audio', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Media Player');
  const win = page.locator('#mediaplayer-window');
  const frame = page.frameLocator('#mediaplayer-window iframe');
  await frame.locator('#play').click();
  await expect.poll(() => frame.locator('#audio').evaluate((audio) => audio.paused)).toBe(false);
  await win.locator('.close-btn').click();
  await expect(win).toBeHidden();
  await expect.poll(() => frame.locator('#audio').evaluate((audio) => audio.paused)).toBe(true);
  expect(await frame.locator('#audio').evaluate((audio) => audio.currentTime)).toBe(0);
});

test('mobile can restore a minimized window and maximize it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRetro(page);
  await openDesktopWindow(page, 'Kladblok');
  const win = page.locator('#notepad-window');
  await win.locator('.min-btn').click();
  await expect(win).toBeHidden();
  const taskButton = page.locator('.taskbar-window-btn[data-window="notepad-window"]');
  await expect(taskButton).toBeVisible();
  await taskButton.click();
  await expect(win).toBeVisible();
  await win.locator('.max-btn').click();
  const box = await win.boundingBox();
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(box.width).toBe(390);
  expect(box.height).toBeLessThan(844);
});

test('dragging keeps a window title bar reachable', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Kladblok');
  const titlebar = page.locator('#notepad-window .win-titlebar');
  const start = await titlebar.boundingBox();
  await page.mouse.move(start.x + 40, start.y + 8);
  await page.mouse.down();
  await page.mouse.move(-900, -700, { steps: 4 });
  await page.mouse.up();
  const box = await page.locator('#notepad-window').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeGreaterThanOrEqual(32);
});

test('Run launches Calculator and its keypad stays inside the window', async ({ page }) => {
  await openRetro(page);
  await page.locator('#start-btn').click();
  await page.getByText('Uitvoeren...', { exact: true }).click();
  await page.locator('#run-command').fill('calc');
  await page.locator('#run-form').getByRole('button', { name: 'OK', exact: true }).click();
  const calculator = page.locator('#calculator-window');
  await expect(calculator).toBeVisible();
  const windowBox = await calculator.boundingBox();
  const lastKeyBox = await page.locator('#calculator-keys .win-btn').nth(15).boundingBox();
  expect(lastKeyBox.x + lastKeyBox.width).toBeLessThanOrEqual(windowBox.x + windowBox.width - 6);
});

test('Notepad stores a local note across a reload', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Kladblok');
  const note = 'MNRV testnotitie ' + Date.now();
  await page.locator('#notepad-text').fill(note);
  await page.locator('#notepad-save').click();
  await page.reload();
  await openDesktopWindow(page, 'Kladblok');
  await expect(page.locator('#notepad-text')).toHaveValue(note);
});

test('Display Properties applies the selected desktop appearance', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Configuratiescherm');
  await page.locator('#desktop-color').selectOption('#6b3d66');
  await page.locator('#desktop-pattern').selectOption('dots');
  await page.locator('#window-scheme').selectOption('plum');
  await page.locator('#desktop-resolution').selectOption('640');
  await page.locator('#display-apply').click();
  await expect(page.locator('.desktop')).toHaveAttribute('data-resolution', '640');
  const appearance = await page.locator('.desktop').evaluate((desktop) => ({
    color: getComputedStyle(desktop).backgroundColor,
    image: getComputedStyle(desktop).backgroundImage,
  }));
  expect(appearance.color).toBe('rgb(107, 61, 102)');
  expect(appearance.image).toContain('radial-gradient');
});

test('a project file can be dragged into and restored from the Recycle Bin', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Deze computer');
  await page.getByRole('button', { name: /MNRV Projects/ }).dblclick();
  const file = page.getByRole('button', { name: /MNRV_LEESMIJ\.TXT/ });
  await file.dragTo(page.locator('#recycle-desktop-icon'));
  await expect(page.locator('#recycle-desktop-icon img')).toHaveAttribute('src', /RecycleBinFull/);
  await openDesktopWindow(page, 'Prullenbak');
  await expect(page.locator('#recycle-list')).toContainText('MNRV_LEESMIJ.TXT');
  await page.locator('#recycle-list [data-file="MNRV_LEESMIJ.TXT"]').click();
  await page.locator('#recycle-restore').click();
  await expect(page.locator('#recycle-list')).not.toContainText('MNRV_LEESMIJ.TXT');
});

test('Dial-Up Networking completes the connection sequence', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Inbelverbinding');
  await page.locator('#dialup-connect').click();
  await expect(page.locator('#dialup-status')).toHaveText('Verbonden met MNRV Net op 56.000 bps.', { timeout: 5_000 });
  await expect(page.locator('#dialup-progress-bar')).toHaveCSS('width', /\d+/);
});

test('Paint changes the canvas when the visitor draws', async ({ page }) => {
  await openRetro(page);
  await openDesktopWindow(page, 'Paint');
  const canvas = page.locator('#paint-canvas');
  const before = await canvas.evaluate((element) => element.toDataURL());
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 120, { steps: 8 });
  await page.mouse.up();
  const after = await canvas.evaluate((element) => element.toDataURL());
  expect(after).not.toBe(before);
});
