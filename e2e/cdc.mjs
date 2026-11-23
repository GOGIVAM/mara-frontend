// Fonctions du cahier des charges CAMRAIL ajoutées au prototype : marqueurs QR, sonorisation,
// commande vocale, groupe Sécurité ferroviaire, mot de passe, modèles de scénarios, téléphone.
// Prérequis : API (5080) en Development, vite preview (5199). Usage : node e2e/cdc.mjs [captures]
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const U = process.env.MARA_URL || 'http://localhost:5199';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];
const graine = readFileSync(new URL('../../ma_ra_dotnet/Data/DbInitializer.cs', import.meta.url), 'utf8');
const mdp = (u) => graine.match(new RegExp(`\\("${u.replace('.', '\\.')}",\\s+"[^"]+",\\s+"([^"]+)"`))[1];
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log('OK', m); };
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const dossier = mkdtempSync(join(tmpdir(), 'mara-qr-'));
const video = join(dossier, 'marqueur.y4m');
execFileSync(process.execPath, [new URL('./video_marqueur.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), video, 'VUF_POMP_001']);

async function connecter(ctx, utilisateur, motDePasse = mdp(utilisateur)) {
  const p = await ctx.newPage();
  p.erreurs = [];
  p.on('pageerror', (e) => p.erreurs.push(String(e).slice(0, 200)));
  await p.goto(`${U}/`);
  await p.waitForSelector('.login-card');
  await p.fill('.login-card input >> nth=0', utilisateur);
  await p.fill('input[type=password]', motDePasse);
  await p.click('.login-card button.primary-btn');
  await p.waitForSelector('.side-nav');
  return p;
}

// Stubs : lecture vocale, son et reconnaissance de la parole, pour vérifier ce que l'application demande.
const STUBS = () => {
  window.__dits = [];
  window.__signaux = 0;
  window.speechSynthesis.speak = (u) => window.__dits.push(u.text);
  window.speechSynthesis.cancel = () => {};
  const Ctx = window.AudioContext;
  window.AudioContext = class extends Ctx {
    createOscillator() { window.__signaux += 1; return super.createOscillator(); }
  };
  const Faux = class {
    constructor() { window.__voix = this; }
    start() {} stop() {}
    dire(phrase) { this.onresult?.({ results: [[{ transcript: phrase }]] }); }
  };
  window.SpeechRecognition = Faux;
  window.webkitSpeechRecognition = Faux;
  localStorage.setItem('mara.son', JSON.stringify({ signaux: true, lecture: true, voix: true }));
};

const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`, ...GL] });
try {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, permissions: ['camera', 'microphone'] });
  await ctx.addInitScript(STUBS);
  const p = await connecter(ctx, 'tech.dmat');

  // 1. Marqueur QR lu par la caméra, équipement identifié
  await p.goto(`${U}/scan`);
  await p.click('text=Activer la caméra');
  await p.waitForSelector('.marqueur-etat >> text=POMP-001', { timeout: 20000 });
  ok(true, 'marqueur : VUF_POMP_001 lu par la caméra et rattaché à POMP-001');
  ok(await p.locator('text=Ouvrir la maquette de POMP-001').count() === 1, "marqueur : la maquette de l'équipement est proposée");
  await p.click('text=Arrêter');

  // 2. Superposition calée sur le marqueur
  await p.goto(`${U}/modele?actif=pompe-eau-qsk19&mode=camera`);
  await p.waitForFunction(() => document.querySelector('.scene-zone video')?.currentTime > 0.2, null, { timeout: 20000 });
  await p.click('role=tab[name="Réglages"]');
  await p.check("text=Caler sur le marqueur QR de l'équipement");
  await p.waitForSelector('.bandeau-approx >> text=Calée sur le marqueur', { timeout: 20000 });
  await p.waitForTimeout(1500);
  const centre = await p.evaluate(() => {
    const c = document.querySelector('.scene3d canvas');
    const k = document.createElement('canvas'); k.width = 200; k.height = 140;
    const x = k.getContext('2d'); x.drawImage(c, 0, 0, 200, 140);
    const d = x.getImageData(0, 0, 200, 140).data;
    let n = 0; let sx = 0; let sy = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { n += 1; sx += (i / 4) % 200; sy += Math.floor(i / 4 / 200); }
    return { n, x: sx / n / 200, y: sy / n / 140 };
  });
  ok(centre.n > 200 && Math.abs(centre.x - 0.5) < 0.12 && Math.abs(centre.y - 0.5) < 0.15,
    `marqueur : maquette centrée sur le marqueur (${centre.x.toFixed(2)}, ${centre.y.toFixed(2)})`);
  ok((await p.textContent('.reglages')).includes('VUF_POMP_001'), 'marqueur : texte du marqueur affiché');
  if (OUT) await p.locator('.modele-vue').screenshot({ path: `${OUT}/cdc_marqueur.png` });

  // 3. Sonorisation et commande vocale pendant une visite
  await p.goto(`${U}/intervention`);
  if (await p.locator('text=Nouvelle visite').count()) await p.click('text=Nouvelle visite');
  await p.fill('#numero-essieu', `E2E-VOIX-${Date.now() % 100000}`);
  await p.click('text=Démarrer la visite');
  await p.waitForSelector('.etape-courante');
  await p.waitForFunction(() => window.__dits.some((t) => t.startsWith('Étape 1.')));
  ok(true, "lecture : l'étape 1 est lue à voix haute");
  await p.evaluate(() => window.__voix.dire('étape conforme'));
  await p.waitForSelector('.etape-courante >> text=Étape 2 sur');
  ok(await p.evaluate(() => window.__signaux) > 0, 'son : signal joué à la validation');
  ok(true, 'voix : « étape conforme » valide l\'étape');
  await p.evaluate(() => window.__voix.dire('étape précédente'));
  await p.waitForSelector('.etape-courante >> text=Étape 1 sur');
  ok(true, 'voix : « étape précédente » revient en arrière');
  const avant = await p.evaluate(() => window.__dits.length);
  await p.evaluate(() => window.__voix.dire('répéter'));
  ok(await p.evaluate((n) => window.__dits.length > n, avant), 'voix : « répéter » relit la consigne');
  await p.evaluate(() => { localStorage.removeItem('mara.demo.t17.suivi'); });

  // 4. Commande vocale sur la maquette
  await p.goto(`${U}/modele?actif=pompe-eau-qsk19&mode=3d`);
  await p.waitForFunction(() => document.querySelector('.scene3d canvas') && !document.querySelector('.modele-vide'), null, { timeout: 30000 });
  await p.click('role=tab[name="Démontage"]');
  await p.waitForTimeout(500);
  await p.evaluate(() => window.__voix.dire('étape suivante'));
  await p.waitForFunction(() => document.querySelector('.scenario-courante')?.textContent.includes('volute'));
  ok(true, 'voix : « étape suivante » exécute l\'étape de démontage');
  await p.evaluate(() => window.__voix.dire('plan'));
  await p.waitForSelector('role=tab[name="Plan 2D"][selected=true]');
  ok(true, 'voix : « plan » passe en plan 2D');
  ok(p.erreurs.length === 0, `aucune erreur de page ${p.erreurs.join(' ')}`);
  await ctx.close();

  // 5. Groupe Sécurité ferroviaire : consultation seule
  const c2 = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const s = await connecter(c2, 'securite');
  await s.goto(`${U}/intervention`);
  await s.waitForSelector('text=Consultation seule');
  ok(await s.locator('#numero-essieu').count() === 0, 'CMSF : pas de démarrage de visite');
  const statut = await s.evaluate(async () => (await fetch('/api/visites', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('mara.token')}` }, body: '{}',
  })).status);
  ok(statut === 403, `CMSF : l'API refuse l'envoi d'une visite (${statut})`);
  await s.goto(`${U}/modele?actif=signal-led&mode=3d`);
  await s.waitForFunction(() => document.querySelector('.scene3d canvas') && !document.querySelector('.modele-vide'), null, { timeout: 30000 });
  ok(true, 'CMSF : consultation des maquettes autorisée');
  await c2.close();

  // 6. Changement de mot de passe par l'utilisateur
  const c3 = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const f = await connecter(c3, 'formateur');
  const ancien = mdp('formateur');
  const nouveau = 'Essai@CIF2026x';
  await f.goto(`${U}/compte`);
  await f.fill('input[autocomplete=current-password]', ancien);
  await f.fill('input[autocomplete=new-password] >> nth=0', nouveau);
  await f.fill('input[autocomplete=new-password] >> nth=1', nouveau);
  await f.click('text=Changer le mot de passe');
  await f.waitForSelector('text=Mot de passe modifié.');
  ok(true, 'compte : mot de passe changé');
  const retour = await f.evaluate(async ([a, n]) => (await fetch('/api/auth/password', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('mara.token')}` },
    body: JSON.stringify({ ancienMotDePasse: n, nouveauMotDePasse: a }),
  })).status, [ancien, nouveau]);
  ok(retour === 204, 'compte : nouveau mot de passe accepté, ancien rétabli');
  await c3.close();

  // 7. Gamme utilisée comme modèle d'un nouveau scénario
  const c4 = await b.newContext({ viewport: { width: 1366, height: 860 } });
  const a = await connecter(c4, 'admin');
  const code = `E2E-MOD-${Date.now() % 100000}`;
  await a.goto(`${U}/gammes`);
  await a.click('td:text-is("GPMP-001")');
  await a.waitForSelector('.steps >> text=Déposer la pompe en préservant les joints');
  const reponses = [code, 'Pompe à eau, variante de test'];
  a.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(reponses.shift()) : d.accept()));
  await a.click('text=Utiliser comme modèle');
  await a.waitForSelector(`text=Scénario ${code} créé en brouillon`);
  await a.waitForSelector('.steps >> text=Déposer la pompe en préservant les joints');
  ok(await a.locator('.steps li').count() === 9, 'modèle : 9 étapes reprises');
  ok(await a.locator('.steps .lien-maquette').count() >= 5, 'modèle : liens vers la maquette repris');
  await a.click('.panel-head >> text=Supprimer');
  await a.waitForFunction((c) => ![...document.querySelectorAll('td')].some((t) => t.textContent === c), code);
  ok(true, 'modèle : scénario de test supprimé');
  ok(a.erreurs.length === 0, `aucune erreur de page ${a.erreurs.join(' ')}`);
  await c4.close();
} finally {
  await b.close();
}

// 8. Téléphone : pas de défilement horizontal sur les écrans de terrain
const b2 = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...GL] });
try {
  const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await connecter(ctx, 'tech.dif');
  for (const ecran of ['/intervention', '/modele?actif=pompe-eau-qsk19&mode=3d', '/scan', '/equipements', '/compte']) {
    await p.goto(`${U}${ecran}`);
    await p.waitForTimeout(1500);
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (OUT) await p.screenshot({ path: `${OUT}/telephone_${ecran.split(/[/?]/)[1]}.png` });
    ok(deborde <= 1, `téléphone 390 px : ${ecran} sans défilement horizontal (${deborde} px)`);
  }
} finally {
  await b2.close();
}
