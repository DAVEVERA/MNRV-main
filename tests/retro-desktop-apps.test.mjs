import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [index, main, apps, appCss, mainCss, player] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/retro-apps.js', import.meta.url), 'utf8'),
  readFile(new URL('../css/retro-apps.css', import.meta.url), 'utf8'),
  readFile(new URL('../css/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../mediaplayer.html', import.meta.url), 'utf8'),
]);

test('retro route loads the interactive desktop application layer', () => {
  assert.match(index, /css\/retro-apps\.css/);
  assert.match(index, /js\/retro-apps\.js/);
  for (const id of ['computer-window', 'control-panel-window', 'run-window', 'recycle-window', 'notepad-window', 'paint-window', 'dialup-window']) {
    assert.match(apps, new RegExp(`id=["']${id}["']`), `${id} is present`);
  }
});

test('retro apps expose their requested core interactions', () => {
  assert.match(apps, /3½-inch diskette \(A:\)/);
  assert.match(apps, /Lokale schijf \(C:\)/);
  assert.match(apps, /MNRV CD-ROM \(D:\)/);
  assert.match(apps, /desktop-pattern/);
  assert.match(apps, /data-paint-tool="brush"/);
  assert.match(apps, /paint-canvas/);
  assert.match(apps, /text\/mnrv-file/);
  assert.match(apps, /playModemSound/);
  assert.match(apps, /notepad.*mspaint.*calc.*command.*winver.*mnrv/s);
  assert.match(appCss, /recycle-drop-zone\.drop-ready/);
});

test('window manager implements accessible restore, mobile taskbar and icon semantics', () => {
  assert.match(main, /syncMaximizeControl/);
  assert.match(main, /aria-label.*Herstellen/s);
  assert.match(main, /clampWindowPosition/);
  assert.match(main, /titleIcon\.cloneNode/);
  assert.doesNotMatch(main.match(/function minimizeWindow[\s\S]*?\n  }/)?.[0] ?? '', /stopWindowMedia/);
});

test('window chrome follows the supplied Windows 95 references', () => {
  assert.match(mainCss, /--win-titlebar:\s*#000080/);
  assert.match(mainCss, /inset -1px -1px 0 var\(--win-btn-dark\)/);
  assert.match(mainCss, /\.win-titlebar-btn[\s\S]*?width:\s*16px;[\s\S]*?height:\s*14px;/);
  assert.match(mainCss, /\.win-titlebar-btn\.help-btn/);
  assert.match(mainCss, /\.win-titlebar-btn\.close-btn::before[\s\S]*?box-shadow:/);
  assert.match(apps, /titlebar\('Uitvoeren', '', 'help-close'\)/);
  assert.match(apps, /titlebar\('Info over MNRV 95', '', 'close-only'\)/);
  assert.match(main, /win-context-help/);
});

test('media player accepts the same-origin stop command from its parent', () => {
  assert.match(main, /postMessage\(\{ type: 'mnrv-media-stop' \}/);
  assert.match(player, /event\.source !== window\.parent/);
  assert.match(player, /event\.origin !== window\.location\.origin/);
  assert.match(player, /event\.data\.type !== 'mnrv-media-stop'/);
});

test('start menu social links point at real destinations', () => {
  assert.match(index, /href="https:\/\/www\.linkedin\.com\/in\/davevera\/"/);
  assert.match(index, /href="https:\/\/wa\.me\/31682456410"/);
  assert.doesNotMatch(index, /href="#"[^>]*>LinkedIn/);
  assert.doesNotMatch(index, /href="#"[^>]*>WhatsApp/);
});
