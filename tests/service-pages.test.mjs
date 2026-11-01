import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(join(projectRoot, relativePath), 'utf8');

const serviceSlugs = [
  'websites-apps',
  'agentic-ai',
  'maatwerk-integraties',
  'workforce-automation',
  'reputatie-intelligentie',
  'kennisinfrastructuur',
  'ecommerce-wordpress-shopify',
  'seo-ai-vindbaarheid',
];

const count = (source, pattern) => [...source.matchAll(pattern)].length;

test('dienstenhub verwijst met crawlbare links naar alle acht diensten', () => {
  const hub = read('diensten/index.html');

  assert.equal(count(hub, /<h1[\s>]/g), 1);
  assert.match(hub, /<link rel="canonical" href="https:\/\/mnrv\.nl\/diensten\/">/);
  assert.match(hub, /"@type": "CollectionPage"/);
  assert.match(hub, /"@type": "ItemList"/);

  for (const slug of serviceSlugs) {
    assert.match(hub, new RegExp(`href="/diensten/${slug}/"`));
  }
});

test('iedere dienstpagina heeft unieke metadata, inhoud en structured data', () => {
  const titles = new Set();
  const descriptions = new Set();

  for (const slug of serviceSlugs) {
    const html = read(`diensten/${slug}/index.html`);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];

    assert.ok(title, `${slug} mist een title`);
    assert.ok(description, `${slug} mist een meta description`);
    assert.equal(count(html, /<h1[\s>]/g), 1, `${slug} moet precies één h1 hebben`);
    assert.equal(count(html, /<details>/g), 4, `${slug} moet vier zichtbare FAQ's hebben`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://mnrv\\.nl/diensten/${slug}/">`));
    assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large[^"<>]*">/);
    assert.match(html, /"@type": "Service"/);
    assert.match(html, /"@type": "BreadcrumbList"/);
    assert.match(html, /"@type": "FAQPage"/);
    assert.match(html, /href="\/assets\/mnrv\.html#contact"/);

    const structuredDataBlocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];
    assert.ok(structuredDataBlocks.length > 0, `${slug} mist JSON-LD`);
    for (const [, json] of structuredDataBlocks) assert.doesNotThrow(() => JSON.parse(json), `${slug} bevat ongeldige JSON-LD`);

    titles.add(title);
    descriptions.add(description);
  }

  assert.equal(titles.size, serviceSlugs.length, 'titels moeten uniek zijn');
  assert.equal(descriptions.size, serviceSlugs.length, 'meta descriptions moeten uniek zijn');
});

test('hoofdsite linkt naar de volledige dienstenarchitectuur', () => {
  const main = read('assets/mnrv.html');

  for (const slug of serviceSlugs) {
    assert.match(main, new RegExp(`href="/diensten/${slug}/"`));
  }

  assert.match(main, /E-commerce, WordPress &amp; Shopify/);
  assert.match(main, /SEO, GEO &amp; AI-vindbaarheid/);
  assert.match(main, /<div class="footer-main">/);
  assert.doesNotMatch(main, /img\/andrew-dave\.webp/);
});

test('sitemap bevat alleen de bedoelde canonieke pagina’s met actuele lastmod', () => {
  const sitemap = read('sitemap.xml');

  assert.doesNotMatch(sitemap, /<priority>|<changefreq>|minesweeper/i);
  assert.equal(count(sitemap, /<url>/g), 14);

  for (const slug of serviceSlugs) {
    assert.match(sitemap, new RegExp(`<loc>https://mnrv\\.nl/diensten/${slug}/</loc>\\s*<lastmod>2026-11-01</lastmod>`));
  }
});

test('lokale interne targets van de dienstenpagina’s bestaan', () => {
  const pages = ['diensten/index.html', ...serviceSlugs.map((slug) => `diensten/${slug}/index.html`)];

  for (const page of pages) {
    const html = read(page);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    for (const href of hrefs) {
      if (!href.startsWith('/') || href.startsWith('//') || href.includes('#')) continue;

      const target = href.endsWith('/') ? `${href}index.html` : href;
      assert.ok(existsSync(join(projectRoot, target)), `${page} verwijst naar ontbrekend target ${href}`);
    }
  }
});

test('bestaande hoofdpagina’s bevatten geldige JSON-LD', () => {
  for (const page of ['index.html', 'assets/mnrv.html']) {
    const html = read(page);
    const structuredDataBlocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];

    assert.ok(structuredDataBlocks.length > 0, `${page} mist JSON-LD`);
    for (const [, json] of structuredDataBlocks) assert.doesNotThrow(() => JSON.parse(json), `${page} bevat ongeldige JSON-LD`);
  }
});
