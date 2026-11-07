// Vérifie le plan 2D, la maquette 3D et la RA de l'axe. Prérequis : API (5080), vite preview (5199).
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

// Part de pixels dessinés : un canevas WebGL vide donne zéro.
const pixels = (p, rouge = false) => p.evaluate((r) => {
  const c = document.querySelector('.scene3d canvas');
  const copie = document.createElement('canvas');
  copie.width = 300; copie.height = 200;
  const ctx = copie.getContext('2d');
  ctx.drawImage(c, 0, 0, 300, 200);
  const d = ctx.getImageData(0, 0, 300, 200).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (!r || (d[i] > d[i + 1] + 40 && d[i] > d[i + 2] + 40)) n += 1;
  }
  return n;
}, rouge);

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

  await p.goto(`${U}/modele`);
  await p.waitForSelector('.plan-axe svg');
  ok(await p.locator('text=1774 mm').count() === 1, 'plan 2D : longueur du plan affichée');
  ok(await p.locator('.cotes div').count() === 5, 'plan 2D : cinq cotes sourcées');
  ok((await p.locator('.modele-tete p').textContent()).includes("pas l'essieu T17"), 'avertissement : pas le T17');
  await p.click('.organe >> text=Fusées');
  ok(await p.locator('.plan-axe-zone-active').count() === 2, 'plan 2D : les deux fusées surlignées');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_plan.png` });

  await p.click('role=tab[name="Maquette 3D"]');
  await p.waitForSelector('.scene3d canvas');
  await p.waitForTimeout(2500);
  ok(await pixels(p) > 1000, '3D : axe dessiné');
  await p.click('.organe >> text=Portées de calage');
  await p.waitForTimeout(600);
  ok(await pixels(p, true) > 30, '3D : organe en surbrillance');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_3d.png` });

  await p.click('role=tab[name="Réalité augmentée"]');
  await p.waitForFunction(() => document.querySelector('.scene-zone video')?.currentTime > 0.2, null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  ok(await p.locator('.scene3d-transparente canvas').count() === 1, 'RA : maquette sur la caméra');
  await p.fill('#ra-echelle', process.env.MARA_ECHELLE || '1.4');
  if (process.env.MARA_X) await p.fill('#ra-x', process.env.MARA_X);
  if (process.env.MARA_Y) await p.fill('#ra-y', process.env.MARA_Y);
  await p.waitForTimeout(500);
  ok(await pixels(p) > 500, 'RA : calage appliqué');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_ra.png` });

  ok(erreurs.length === 0, `aucune erreur de page ${erreurs.join(' ')}`);
} finally {
  await b.close();
}
