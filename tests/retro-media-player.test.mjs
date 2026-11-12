import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const playerPath = new URL('../mediaplayer.html', import.meta.url);
const player = await readFile(playerPath, 'utf8');

test('retro media player exposes a full native control set', () => {
  for (const control of ['previous', 'rewind', 'play', 'pause', 'stop', 'forward', 'next', 'seek', 'volume', 'shuffle', 'repeat']) {
    assert.match(player, new RegExp(`id=["']${control}["']`), `${control} control is present`);
  }

  assert.match(player, /<audio\s+id="audio"/);
  assert.match(player, /audio\.addEventListener\(['"]timeupdate['"]/);
  assert.match(player, /audio\.addEventListener\(['"]ended['"]/);
  assert.match(player, /event\.code\s*===\s*['"]Space['"]/);
});

test('playlist contains the bundled Windows 95 media examples', async () => {
  const files = [
    'The Microsoft Sound.mp3',
    'Microsoft Windows 95 Startup Sound.mp3',
    "Bach's Brandenburg Concerto No. 3.mp3",
    "Beethoven's 5th Symphony.mp3",
    "Beethoven's Fur Elise.mp3",
    'Dance of the Sugar-Plum Fairy.mp3',
    "Debussy's Claire de Lune.mp3",
    'In the Hall of the Mountain King.mp3',
    "Mozart's Symphony No. 40.mp3",
  ];

  for (const file of files) {
    assert.ok(player.includes(file), `${file} is listed`);
    await access(new URL(`../assets/audio/${file}`, import.meta.url));
  }

  assert.equal((player.match(/type:\s*['"](?:WAV|MIDI)-conversie['"]/g) ?? []).length, 9);
});

test('player does not depend on the old bundled React demo', () => {
  assert.doesNotMatch(player, /mediaplayer\.bundle\.js/);
  assert.doesNotMatch(player, /ReactDOM|<iframe/i);
});
