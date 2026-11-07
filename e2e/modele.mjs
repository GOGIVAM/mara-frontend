// Vérifie les trois vues, vides en attendant les plans de l'essieu. Prérequis : API (5080), vite preview (5199).
// Usage : node e2e/modele.mjs [dossier de captures]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const U = process.env.MARA_URL || 'http://localhost:5199';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];
const CAMERA = process.env.MARA_CAMERA;
const graine = readFileSync(new URL('../../ma_ra_dotnet/Data/DbInitializer.cs', import.meta.url), 'utf8');
const mdp = graine.match(/\("tech\.dmat",\s+"[^"]+",\s+"([^"]+)"/)[1];
const ok = (c, m) => { if (!c) throw new Error(m); console.log('OK', m); };

const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
if (CAMERA) args.push(`--use-file-for-fake-video-capture=${CAMERA}`);
const b = await chromium.launch({ executablePath: CHROME, args });
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: OUT ? 2 : 1, permissions: ['camera'] });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await p.goto(`${U}/`);
  await p.waitForSelector('.login-card');
  await p.fill('.login-card input >> nth=0', 'tech.dmat');
  await p.fill('input[type=password]', mdp);
  await p.click('.login-card button.primary-btn');
  await p.waitForSelector('.side-nav');

  const message = 'text=Aucun modèle chargé';

  await p.goto(`${U}/modele`);
  await p.waitForSelector('.modele-vue');
  ok(await p.locator(message).count() === 1, 'plan 2D : aucun modèle signalé');
  ok(await p.locator('.scene3d canvas').count() === 0, 'plan 2D : pas de scène 3D');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_plan.png` });

  await p.click('role=tab[name="Maquette 3D"]');
  await p.waitForSelector('.scene3d canvas');
  ok(await p.locator(message).count() === 1, '3D : aucun modèle signalé');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_3d.png` });

  await p.click('role=tab[name="Réalité augmentée"]');
  await p.waitForFunction(() => document.querySelector('.scene-zone video')?.currentTime > 0.2, null, { timeout: 15000 });
  ok(await p.locator('.scene3d-transparente canvas').count() === 1, 'RA : scène sur la caméra');
  ok(await p.locator(message).count() === 1, 'RA : aucun modèle signalé');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_ra.png` });

  ok(erreurs.length === 0, `aucune erreur de page ${erreurs.join(' ')}`);
} finally {
  await b.close();
}
