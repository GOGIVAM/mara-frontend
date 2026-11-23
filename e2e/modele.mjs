// Vérifie le plan coté, l'atelier 3D et la caméra de l'axe EG6 (catalogue). Prérequis : API (5080), vite preview (5199).
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

// Centre des pixels dessinés, en coordonnées de la page.
const centre = (p) => p.evaluate(() => {
  const c = document.querySelector('.scene3d canvas');
  const r = c.getBoundingClientRect();
  const copie = document.createElement('canvas');
  copie.width = 300; copie.height = 200;
  const ctx = copie.getContext('2d');
  ctx.drawImage(c, 0, 0, 300, 200);
  const d = ctx.getImageData(0, 0, 300, 200).data;
  let n = 0; let sx = 0; let sy = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const k = i / 4;
    n += 1; sx += k % 300; sy += Math.floor(k / 300);
  }
  return { x: r.left + (sx / n / 300) * r.width, y: r.top + (sy / n / 200) * r.height };
});

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

  await p.goto(`${U}/modele?actif=axe-eg6`);
  await p.waitForSelector('.plan-axe svg');
  ok(await p.locator('text=1774 mm').count() === 1, 'plan 2D : longueur du plan affichée');
  ok((await p.locator('.modele-avertissement').textContent()).includes("pas l'essieu T17"), 'avertissement : pas le T17');
  await p.click('role=tab[name="Sources"]');
  ok(await p.locator('.table-cotes tbody tr').count() === 5, 'plan 2D : cinq cotes sourcées, statut plan');
  await p.click('role=tab[name="Pièces"]');
  await p.click('.organe >> text=Fusées');
  ok(await p.locator('.plan-axe-zone-active').count() === 2, 'plan 2D : les deux fusées surlignées');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_plan.png` });

  await p.click('role=tab[name="Atelier 3D"]');
  await p.waitForSelector('.scene3d canvas');
  await p.waitForTimeout(2500);
  ok(await pixels(p) > 1000, '3D : axe dessiné');
  await p.click('.organe >> text=Fusées');
  await p.click('.organe >> text=Portées de calage');
  await p.waitForTimeout(600);
  ok(await pixels(p, true) > 30, '3D : organe en surbrillance');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_3d.png` });

  await p.click('role=tab[name="Caméra"]');
  await p.waitForFunction(() => document.querySelector('.scene-zone video')?.currentTime > 0.2, null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  ok(await p.locator('.scene3d-transparente canvas').count() === 1, 'RA : maquette sur la caméra');
  await p.click('role=tab[name="Réglages"]');
  await p.fill('#ra-echelle', process.env.MARA_ECHELLE || '1.4');
  if (process.env.MARA_X) await p.fill('#ra-x', process.env.MARA_X);
  if (process.env.MARA_Y) await p.fill('#ra-y', process.env.MARA_Y);
  await p.waitForTimeout(500);
  ok(await pixels(p) > 500, 'RA : calage appliqué');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_ra.png` });

  // Déplacement d'une pièce : on glisse depuis le centre du dessin, puis on remet en place.
  const avant = await centre(p);
  const remettre = p.locator('text=Remettre les pièces déplacées en place');
  ok(await remettre.isDisabled(), 'RA : bouton de remise en place inactif au départ');
  await p.click('.barre-outils >> text=Déplacer une pièce');
  await p.mouse.move(avant.x, avant.y);
  await p.mouse.down();
  await p.mouse.move(avant.x, avant.y + 90, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  const deplace = await centre(p);
  ok(deplace.y - avant.y > 15, `RA : pièce déplacée au doigt (${Math.round(deplace.y - avant.y)} px vers le bas)`);
  ok(await remettre.isEnabled(), 'RA : remise en place proposée');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/modele_ra_deplace.png` });
  await remettre.click();
  await p.waitForTimeout(1500);
  const remis = await centre(p);
  ok(Math.abs(remis.y - avant.y) < 4 && Math.abs(remis.x - avant.x) < 4, 'RA : pièces remises en place');

  ok(erreurs.length === 0, `aucune erreur de page ${erreurs.join(' ')}`);
} finally {
  await b.close();
}
