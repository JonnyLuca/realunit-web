#!/usr/bin/env node
/**
 * Static-site completeness gate for realunit.app.
 *
 * Fails closed (exit 1) on structural defects a contributor could ship without
 * noticing on a no-build static site:
 *   - a page whose <html> has no valid `lang`
 *   - an internal link / asset reference that does not resolve to a file under
 *     public/ (the same resolution the dev server and Cloudflare Pages use)
 *   - index.html without an https og:url to anchor the site origin
 *   - a page that loads a glue script without first loading the js/lib core it
 *     depends on (platform.js → platform-core.js, confirm.js → confirm-core.js,
 *     merge.js → merge-core.js)
 *
 * i18n key parity (de/en) and the data-i18n coverage of the confirm page live in
 * the unit test (test/confirm-core.test.mjs), which can import the copy directly.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const PUBLIC = join(root, 'public');
const LANGS = ['de', 'en'];
const errors = [];
const fail = (msg) => errors.push(msg);
const read = (absPath) => readFileSync(absPath, 'utf8');

function listHtml(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listHtml(full));
    else if (extname(entry) === '.html') out.push(full);
  }
  return out;
}
const htmlFiles = listHtml(PUBLIC).sort();

// --- origin ------------------------------------------------------------------
// Derive the canonical origin from index.html's og:url so the gate follows the
// site if the domain ever moves.
function extractOgUrl(html) {
  const meta = html.match(/<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i);
  if (!meta) return null;
  const content = meta[0].match(/\bcontent=["']([^"']+)["']/i);
  return content ? content[1] : null;
}
const indexOgUrl = extractOgUrl(read(join(PUBLIC, 'index.html')));
if (!indexOgUrl) {
  fail('public/index.html: no og:url to derive the site origin from');
}
let ORIGIN = null;
if (indexOgUrl) {
  const url = new URL(indexOgUrl);
  if (url.protocol !== 'https:') fail(`public/index.html: og:url "${indexOgUrl}" is not https`);
  ORIGIN = url.origin;
}

// --- path resolution (mirrors scripts/dev-server.mjs / Cloudflare Pages) ------
function resolvesToFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.split('#')[0].split('?')[0]);
  } catch {
    return false;
  }
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  let target = join(PUBLIC, rel);
  if (!target.startsWith(PUBLIC)) return false;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }
  return existsSync(target) && statSync(target).isFile();
}

function checkReference(label, value) {
  const raw = value.trim();
  if (!raw) return;
  if (/^(mailto:|tel:|#)/i.test(raw)) return;
  if (/^\/\//.test(raw)) return; // protocol-relative → external
  // Any non-http(s) URI scheme (data:, realunit-wallet://, …) is not a file.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return;

  let pathname;
  if (/^https?:\/\//i.test(raw)) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      fail(`${label}: unparsable URL "${raw}"`);
      return;
    }
    if (url.origin !== ORIGIN) return; // external asset/link
    pathname = url.pathname;
  } else {
    pathname = ('/' + raw.replace(/^\.?\//, '')).split('#')[0].split('?')[0];
  }

  if (!resolvesToFile(pathname)) {
    fail(`${label}: internal reference does not resolve — "${raw}"`);
  }
}

// A page that loads a glue script must load its js/lib core first, or the glue
// throws on window.RealUnit* before it can run.
function checkScriptOrder(label, html, gluePath, corePath) {
  const glueIndex = html.indexOf(gluePath);
  if (glueIndex === -1) return;
  const coreIndex = html.indexOf(corePath);
  if (coreIndex === -1) {
    fail(`${label}: loads ${gluePath} but never loads its dependency ${corePath}`);
  } else if (coreIndex > glueIndex) {
    fail(`${label}: ${corePath} must be loaded before ${gluePath}`);
  }
}

let referenceCount = 0;
for (const file of htmlFiles) {
  const label = 'public/' + relative(PUBLIC, file);
  const html = read(file);

  const langMatch = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  if (!langMatch) {
    fail(`${label}: <html> has no lang attribute`);
  } else if (!LANGS.includes(langMatch[1])) {
    fail(`${label}: <html lang="${langMatch[1]}"> is not one of ${LANGS.join(', ')}`);
  }

  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    referenceCount += 1;
    checkReference(label, match[1]);
  }

  checkScriptOrder(label, html, '/platform.js', '/js/lib/platform-core.js');
  checkScriptOrder(label, html, '/confirm-aktionariat/confirm.js', '/js/lib/confirm-core.js');
  checkScriptOrder(label, html, '/account-merge/merge.js', '/js/lib/merge-core.js');
}

if (errors.length > 0) {
  for (const message of errors) console.error(`error    ${message}`);
  console.error(`\ncheck-site: ${errors.length} error(s) across ${htmlFiles.length} HTML files.`);
  process.exit(1);
}
console.log(
  `check-site: OK — ${htmlFiles.length} HTML files, ${referenceCount} references checked.`,
);
