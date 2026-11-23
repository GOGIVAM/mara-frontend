// Parcours du catalogue de maquettes depuis les écrans habituels de MA-RA.
// Prérequis : API (5080) en Development, vite preview (5199). Le service IA n'est pas requis.
// Usage : node e2e/maquettes.mjs [dossier de captures]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const U = process.env.MARA_URL || 'http://localhost:5199';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];
const graine = readFileSync(new URL('../../ma_ra_dotnet/Data/DbInitializer.cs', import.meta.url), 'utf8');
const mdp = graine.match(/\("tech\.dmat",\s+"[^"]+",\s+"([^"]+)"/)[1];
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log('OK', m); };
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const pixels = (p) => p.evaluate(() => {
  const c = document.querySelector('.scene3d canvas');
  if (!c) return 0;
  const copie = document.createElement('canvas');
  copie.width = 200; copie.height = 140;
  const ctx = copie.getContext('2d');
  ctx.drawImage(c, 0, 0, 200, 140);
  const d = ctx.getImageData(0, 0, 200, 140).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] && !(d[i] > 230 && d[i + 1] > 230 && d[i + 2] > 230)) n += 1;
  return n;
});
const chargee = (p) => p.waitForFunction(() => document.querySelector('.scene3d canvas') && !document.querySelector('.modele-vide'), null, { timeout: 30000 });

async function connecter(ctx) {
  const p = await ctx.newPage();
  p.erreurs = [];
  p.on('pageerror', (e) => p.erreurs.push(String(e).slice(0, 200)));
  await p.goto(`${U}/`);
  await p.waitForSelector('.login-card');
  await p.fill('.login-card input >> nth=0', 'tech.dmat');
  await p.fill('input[type=password]', mdp);
  await p.click('.login-card button.primary-btn');
  await p.waitForSelector('.side-nav');
  return p;
}

const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...GL] });
try {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, permissions: ['camera'] });
  const p = await connecter(ctx);

  // 1. Fiche équipement → maquette
  await p.goto(`${U}/equipements`);
  await p.click('td:text-is("POMP-001")');
  await p.waitForSelector('.fiche-maquette >> text=Ouvrir la maquette');
  ok((await p.textContent('.fiche-maquette')).includes('Illustratif'), 'fiche : statut documentaire affiché');
  await p.click('.fiche-maquette >> text=Ouvrir la maquette');
  await p.waitForURL(/actif=pompe-eau-qsk19/);
  await chargee(p);
  await p.waitForTimeout(800);
  ok(await pixels(p) > 500, 'plan 2D : maquette dessinée depuis la fiche');
  ok(await p.locator('.repere:visible').count() >= 8, 'plan 2D : repères de nomenclature affichés');
  await p.locator('.repere:visible').first().click();
  ok(new URL(p.url()).searchParams.get('piece'), 'plan 2D : un repère sélectionne la pièce');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/pompe_plan.png` });

  // 2. Cycle dévissage – dépose – repose, éclaté sans perte d'état, annulation
  await p.click('role=tab[name="Atelier 3D"]');
  await p.click('role=tab[name="Démontage"]');
  const bouton = p.locator('.demontage .primary-btn');
  await bouton.click();                                   // d1 : dévisser
  await bouton.click();                                   // d2 : déposer la volute
  await p.waitForTimeout(400);
  ok((await p.textContent('.scenario-courante')).includes('joint torique'), 'démontage : étape suivante proposée');
  await p.click('role=tab[name="Réglages"]');
  await p.fill('#eclate', '1');
  await p.waitForTimeout(700);
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/pompe_eclate.png` });
  await p.fill('#eclate', '0');
  await p.click('role=tab[name="Démontage"]');
  ok((await p.textContent('.scenario-courante')).includes('joint torique'), "éclaté : l'état du démontage est conservé");
  await p.click('.demontage >> text=Annuler');
  ok((await p.textContent('.scenario-courante')).includes('volute'), 'annulation : la volute revient');
  let tours = 0;
  while (await bouton.count() && tours < 40) { await bouton.click(); tours += 1; await p.waitForTimeout(60); }
  ok(tours === 20 - 1, `scénario complet exécuté (${tours} actions)`);
  await p.waitForSelector('text=Remontage terminé');
  await p.waitForFunction(() => document.querySelector('.ecart-pose')?.dataset.ecart === '0', null, { timeout: 15000 });
  ok((await p.textContent('.ecart-pose')).includes('0,00 mm'), 'repose : pose finale identique à la pose initiale (0,00 mm)');

  // 3. Navigation : vues, zoom, isolement, coupe
  await p.click('role=tab[name="Pièces"]');
  await p.click('.organe >> text=Roue à aubes');
  await p.click('.fiche-actions >> text=Isoler');
  await p.click('.barre-outils >> text=Face');
  await p.click('.barre-outils >> text=Recentrer');
  await p.waitForTimeout(700);
  ok(await pixels(p) > 300, 'isolement : la roue seule est affichée et recadrée');
  await p.click('.fiche-actions >> text=Tout afficher');
  await p.click('role=tab[name="Réglages"]');
  await p.check('.reglages .case input');
  await p.waitForTimeout(500);
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/pompe_coupe.png` });
  await p.uncheck('.reglages .case input');

  // 4. Gamme → étape → pièce, puis passage simulation → caméra en gardant pièce et étape
  await p.goto(`${U}/gammes`);
  await p.click('td:text-is("GPMP-001")');
  await p.waitForSelector('.steps >> text=Déposer la pompe en préservant les joints');
  await p.locator('.steps .lien-maquette').first().click();
  await p.waitForSelector('.etape-gamme');
  await chargee(p);
  const piece = new URL(p.url()).searchParams.get('piece');
  ok(piece === 'volute', `gamme : l'étape ouvre la pièce liée (${piece})`);
  await p.click('.etape-gamme >> text=Étape suivante');
  await p.waitForURL(/piece=garniture/);
  ok(true, "gamme : l'étape suivante sélectionne la garniture");
  const etape = new URL(p.url()).searchParams.get('etape');
  await p.click('role=tab[name="Caméra"]');
  await p.waitForFunction(() => document.querySelector('.scene-zone video')?.currentTime > 0.2, null, { timeout: 15000 });
  ok(await p.locator('.bandeau-approx').isVisible(), 'caméra : superposition présentée comme approximative');
  const url = new URL(p.url());
  ok(url.searchParams.get('piece') === 'garniture' && url.searchParams.get('etape') === etape, 'caméra : pièce et étape conservées');
  ok((await p.textContent('.etape-gamme')).includes('garniture'), "caméra : bandeau d'étape conservé");
  await p.click('role=tab[name="Réglages"]');
  await p.fill('#ra-echelle', '0.8');
  await p.check('text=Repères seuls');
  await p.waitForTimeout(500);
  ok(await p.locator('.repere:visible').count() > 0, 'caméra : repères seuls sur la vidéo');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/pompe_camera.png` });
  await p.click('role=tab[name="Atelier 3D"]');
  ok(new URL(p.url()).searchParams.get('piece') === 'garniture', 'retour simulation : pièce conservée');

  // 5. RA suivie : capacités vérifiées, repli si non disponible
  await p.click('role=tab[name="RA suivie"]');
  await p.waitForSelector('.capacites li >> nth=2');
  await p.waitForFunction(() => !document.querySelector('.capacites')?.textContent.includes('…'));
  const placer = p.locator('text=Placer la maquette (démonstration)');
  ok(await placer.isDisabled(), 'RA suivie : bouton inactif sur un terminal sans immersive-ar');
  ok((await p.textContent('.xr-panneau')).includes("recalage sur l'équipement réel"), 'RA suivie : démonstration et recalage distingués');

  // 6. Les douze classes et l'axe se chargent
  const actifs = await p.locator('#choix-actif option').evaluateAll((o) => o.map((x) => x.value));
  ok(actifs.length === 13, `catalogue : ${actifs.length} maquettes`);
  await p.click('role=tab[name="Atelier 3D"]');
  for (const a of actifs) {
    await p.selectOption('#choix-actif', a);
    await chargee(p);
    await p.waitForTimeout(500);
    const n = await pixels(p);
    if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/classe_${a}.png` });
    ok(n > 300, `${a} : vue d'ensemble dessinée`);
  }

  // 7. Consultation hors ligne
  await p.evaluate(() => navigator.serviceWorker?.ready);
  await p.click('role=tab[name="Hors ligne"]');
  await p.click('text=Préparer la visite hors ligne');
  await p.waitForFunction(() => document.querySelectorAll('.hl-integre').length === 13, null, { timeout: 60000 });
  ok(true, 'hors ligne : 13 maquettes téléchargées et intègres');
  await ctx.setOffline(true);
  await p.goto(`${U}/modele?actif=signal-led&mode=3d`);
  await chargee(p);
  await p.waitForTimeout(600);
  ok(await pixels(p) > 300, 'hors ligne : maquette du signal affichée sans réseau');
  ok(await p.locator('.badge-demo >> text=Hors ligne').count() === 1, 'hors ligne : mode signalé');
  await ctx.setOffline(false);
  ok(p.erreurs.length === 0, `aucune erreur de page ${p.erreurs.join(' ')}`);
} finally {
  await b.close();
}

// 8. Caméra refusée : retour immédiat à la 3D, pièce et étape conservées
const b2 = await chromium.launch({ executablePath: CHROME, args: ['--deny-permission-prompts', ...GL] });
try {
  const ctx = await b2.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await connecter(ctx);
  await p.goto(`${U}/modele?actif=pont-roulant-palan&piece=tambour&mode=3d`);
  await chargee(p);
  await p.click('role=tab[name="Caméra"]');
  await p.waitForSelector('.modele-message >> text=caméra', { timeout: 15000 });
  ok(await p.locator('role=tab[name="Atelier 3D"][selected=true]').count() === 1, 'caméra refusée : retour automatique à la 3D');
  ok(new URL(p.url()).searchParams.get('piece') === 'tambour', 'caméra refusée : pièce conservée');
  ok(p.erreurs.length === 0, `aucune erreur de page ${p.erreurs.join(' ')}`);
} finally {
  await b2.close();
}
