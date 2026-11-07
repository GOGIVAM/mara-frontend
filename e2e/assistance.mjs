// Test de bout en bout de l'assistance. Prérequis : API (5080), FastAPI (8000), vite preview (5199).
// Usage : node e2e/assistance.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const U = process.env.MARA_URL || 'http://localhost:5199';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.env.MARA_CAPTURE;
const graine = new URL('../../ma_ra_dotnet/Data/DbInitializer.cs', import.meta.url);
const mdp = (nom) => readFileSync(graine, 'utf8').match(new RegExp(`\\("${nom}",\\s+"[^"]+",\\s+"([^"]+)"`))[1];
const ok = (c, m) => { if (!c) throw new Error(m); console.log('OK', m); };

async function connecter(navigateur, nom) {
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();
  await page.goto(`${U}/`);
  await page.waitForSelector('.login-card');
  await page.fill('.login-card input >> nth=0', nom);
  await page.fill('input[type=password]', mdp(nom));
  await page.click('.login-card button.primary-btn');
  await page.waitForSelector('.side-nav');
  await page.goto(`${U}/assistance`);
  return page;
}

const rougeSurCanvas = (page) => page.$eval('.assistance-figee canvas', (c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) n += 1;
  return n;
});

const navigateur = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  const salle = `e2e-${Date.now()}`;
  const tech = await connecter(navigateur, 'tech.dmat');
  const expert = await connecter(navigateur, 'chef.dmat');
  for (const p of [tech, expert]) {
    await p.fill('#salle', salle);
    await p.click('text=Rejoindre');
  }
  await tech.waitForSelector('text=Connecté', { timeout: 20000 });
  await expert.waitForSelector('text=Connecté', { timeout: 20000 });
  ok(true, 'deux personnes connectées par ticket');

  await expert.waitForFunction(() => {
    const v = document.querySelector('.assistance-videos video');
    return v.videoWidth > 0 && v.currentTime > 0;
  }, null, { timeout: 15000 });
  ok(true, "vidéo de l'autre personne reçue");

  await expert.click("text=Figer l'image de l'autre");
  await tech.waitForSelector('.assistance-figee canvas');
  await expert.waitForSelector('.assistance-figee canvas');
  await expert.waitForTimeout(600);
  ok(true, "image figée partagée à l'initiative de l'expert");

  const avant = await rougeSurCanvas(tech);
  await expert.locator('.assistance-figee canvas').scrollIntoViewIfNeeded();
  const zone = await expert.locator('.assistance-figee canvas').boundingBox();
  await expert.mouse.move(zone.x + 40, zone.y + 40);
  await expert.mouse.down();
  await expert.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2, { steps: 8 });
  await expert.mouse.up();
  await tech.waitForFunction((n) => {
    const c = document.querySelector('.assistance-figee canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let t = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) t += 1;
    return t > n + 100;
  }, avant, { timeout: 8000 });
  ok(true, 'annotation reçue par le technicien');
  if (OUT) await tech.screenshot({ path: OUT, fullPage: true });

  await expert.click('text=Audio seul');
  await expert.waitForSelector('text=Rétablir la vidéo');
  ok(true, 'bascule en audio seul');

  await expert.click('text=Quitter');
  await tech.waitForSelector("text=En attente de l'autre personne", { timeout: 8000 });
  ok(true, 'départ détecté');
} finally {
  await navigateur.close();
}
