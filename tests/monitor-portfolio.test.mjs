import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../assets/mnrv.html', import.meta.url);
const cssPath = new URL('../assets/portfolio-monitors.css', import.meta.url);
const scriptPath = new URL('../assets/portfolio-monitors.js', import.meta.url);

const [html, css, script] = await Promise.all([
  readFile(htmlPath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(scriptPath, 'utf8'),
]);

const section = html.match(/<section\s+class="monitor-portfolio"[\s\S]*?<\/section>/i)?.[0];

test('modern route contains one eight-screen work section', () => {
  assert.ok(section, 'monitor portfolio section is present');
  assert.match(section, /\bid="werk"/);
  assert.equal((section.match(/<button\s+class="monitor-screen"/g) ?? []).length, 8);
  assert.doesNotMatch(section, /<iframe\b/i, 'overview must not eagerly load live sites');
  assert.equal((html.match(/<section\s+class="monitor-portfolio"/g) ?? []).length, 1);
});

test('monitor portfolio sits between the restored hero and services', () => {
  const heroIndex = html.indexOf('<section class="hero">');
  const portfolioIndex = html.indexOf('<section class="monitor-portfolio"');
  const servicesIndex = html.indexOf('<section class="diensten"');

  assert.ok(
    heroIndex < portfolioIndex && portfolioIndex < servicesIndex,
    'hero, monitor portfolio and services follow the intended order',
  );
  assert.match(html, /<section\s+class="hero">[\s\S]*?<h1\s+class="hero-title">Verbinden doet versnellen\.<\/h1>/);
  assert.match(html, /<section\s+class="hero">[\s\S]*?class="hero-portret-img"/);
  assert.match(section, /<h2\s+class="monitor-portfolio__title"[^>]*>Acht projecten\. Eén interactieve wand\.<\/h2>/);
  assert.doesNotMatch(section, /monitor-hero__portrait|monitor-hero__copy/);
});

test('navbar remains transparent instead of changing on scroll', () => {
  assert.match(html, /body\s*>\s*nav\s*\{[\s\S]*?background:\s*transparent;/);
  assert.doesNotMatch(html, /nav\.style\.background/);
});

test('all monitor projects have local previews and live destinations', async () => {
  const expectedProjects = [
    'fainl',
    'mrsvision',
    'windofy',
    'mr-jealousy',
    'denotenman',
    'stuk-verdriet',
    'mnrv',
    'oostendorp',
  ];

  for (const project of expectedProjects) {
    const button = section.match(
      new RegExp(`<button[^>]+data-project="${project}"[\\s\\S]*?<\\/button>`, 'i'),
    )?.[0];

    assert.ok(button, `${project}: monitor button exists`);
    assert.match(button, /\bdata-live-url="[^"]+"/i, `${project}: live URL`);
    assert.match(button, /\bdata-external-url="https:\/\/[^"]+"/i, `${project}: external URL`);

    const preview = button.match(/<img[^>]+src="([^"]+)"/i)?.[1];
    assert.ok(preview, `${project}: preview image`);
    await access(new URL(`../assets/${preview}`, import.meta.url));
  }

  await access(new URL('../assets/img/portfolio/monitor-wall.png', import.meta.url));
});

test('monitor interaction lazy-loads one iframe and supports every close route', () => {
  assert.match(script, /document\.createElement\(['"]iframe['"]\)/);
  assert.match(script, /iframe\.src\s*=\s*project\.liveUrl/);
  assert.match(script, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(script, /closest\(['"]\[data-monitor-close\]['"]\)/);
  assert.match(script, /returnFocus\.focus\(\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('sites that refuse framing receive an explicit external fallback', () => {
  for (const project of ['fainl', 'mr-jealousy', 'stuk-verdriet', 'oostendorp']) {
    const button = section.match(
      new RegExp(`<button[^>]+data-project="${project}"[^>]*>`, 'i'),
    )?.[0];
    assert.match(button, /\bdata-embed="false"/i, `${project}: blocked embed is declared`);
  }

  assert.match(script, /const createFrameFallback/);
  assert.match(script, /if \(project\.embeddable\) createLiveFrame\(project\)/);
});
