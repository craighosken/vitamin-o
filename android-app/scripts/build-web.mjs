// Builds www/index.html from the shared tracker (../pen-tracker.html) so the web
// artifact and the app stay one codebase. Injects src/native.js, which only
// does anything when running inside the Capacitor app.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.TRACKER_HTML || [join(root, 'web/pen-tracker.html'), join(root, '../pen-tracker.html')].find(existsSync);
if (!src) throw new Error('pen-tracker.html not found');
let html = readFileSync(src, 'utf8');
const native = readFileSync(join(root, 'src/native.js'), 'utf8');

// 1. Bridge goes in before the app scripts so it can restore saved data first.
html = html.replace('<script id="core">', `<script>\n${native}\n</script>\n<script id="core">`);

// 2. Start-up waits for the bridge (Preferences are async; the app reads localStorage synchronously).
const boot = 'load();\nif (st.setupDone) hideSetup(); else showSetup();';
if (!html.includes(boot)) throw new Error('start-up lines changed in pen-tracker.html; update build-web.mjs');
html = html.replace(boot, `PenNative.ready.then(() => {\n  ${boot.replace('\n', '\n  ')}\n  PenNative.afterBoot();\n});`);

mkdirSync(join(root, 'www'), { recursive: true });
writeFileSync(join(root, 'www/index.html'), html);
console.log(`www/index.html built from ${src} (${(html.length / 1024).toFixed(0)} KB)`);
