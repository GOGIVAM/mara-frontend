// Données locales chiffrées et file d'envoi liée au compte signataire.
// Prérequis : API (5080), vite preview (5199). Laisse une visite préfixée E2E-CHIF-.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const U = process.env.MARA_URL || 'http://localhost:5199';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const graine = readFileSync(new URL('../../ma_ra_dotnet/Data/DbInitializer.cs', import.meta.url), 'utf8');
const mdp = (u) => graine.match(new RegExp(`\\("${u.replace('.', '\\.')}",\\s+"[^"]+",\\s+"([^"]+)"`))[1];
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log('OK', m); };

const brut = (p) => p.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('mara-terrain');
  r.onsuccess = () => {
    const tx = r.result.transaction('envois', 'readonly');
    const q = tx.objectStore('envois').getAll();
    q.onsuccess = () => {
      res(q.result.map((e) => ({
        id: e.id, compte: e.compte, chiffre: Boolean(e.chiffre?.donnees), texte: JSON.stringify(e),
      })));
      r.result.close();
    };
  };
  r.onerror = () => rej(r.error);
}));

async function connecter(p, u) {
  await p.goto(`${U}/`);
  await p.waitForSelector('.login-card');
  await p.fill('.login-card input >> nth=0', u);
  await p.fill('input[type=password]', mdp(u));
  await p.click('.login-card button.primary-btn');
  await p.waitForSelector('.side-nav');
}

const b = await chromium.launch({ executablePath: CHROME });
const essieu = `E2E-CHIF-${Date.now() % 1000000}`;
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  const envois = [];
  p.on('request', (r) => { if (r.url().endsWith('/api/visites') && r.method() === 'POST') envois.push(r.url()); });

  await connecter(p, 'tech.dmat');
  await p.goto(`${U}/intervention`);
  await p.waitForSelector('#numero-essieu');
  await p.evaluate(() => navigator.serviceWorker?.ready);
  await ctx.setOffline(true);

  // Visite complète sans réseau
  await p.fill('#numero-essieu', essieu);
  await p.click('text=Démarrer la visite');
  for (let i = 0; i < 20; i += 1) {
    if (await p.locator('.bilan').count()) break;
    await p.waitForSelector('.etape-courante');
    if (await p.locator('.confirmation-securite input').count()) await p.check('.confirmation-securite input');
    if (await p.locator('#mesure-1').count()) { await p.fill('#mesure-1', '12,5'); await p.fill('#mesure-2', '12,5'); }
    await p.click('.btn-conforme');
    await p.waitForTimeout(150);
  }
  await p.click('text=Signer et clôturer');
  await p.waitForSelector('.tampon');
  const [enreg] = await brut(p);
  ok(enreg && enreg.compte === 'tech.dmat', 'file : visite rattachée au compte signataire');
  ok(enreg.chiffre && !enreg.texte.includes(essieu) && !enreg.texte.includes('12,5'), 'file : visite chiffrée, numéro et mesure illisibles en base locale');

  // Déconnexion : avertissement, puis un autre compte se connecte
  await p.route('**/api/visites', (r) => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.continue()));
  await ctx.setOffline(false);
  let message = '';
  p.once('dialog', (d) => { message = d.message(); d.accept(); });
  await p.click('text=Se déconnecter');
  await p.waitForSelector('.login-card');
  ok(message.includes('pas encore envoyée'), 'déconnexion : avertissement sur la visite non envoyée');
  await p.unroute('**/api/visites');
  envois.length = 0;
  await connecter(p, 'tech.dif');
  await p.waitForTimeout(3000);
  ok(envois.length === 0 && (await brut(p)).length === 1, "autre compte : la visite n'est pas envoyée sous son nom");

  // Le signataire revient : la visite part
  await p.click('text=Se déconnecter');
  await p.waitForSelector('.login-card');
  await connecter(p, 'tech.dmat');
  await p.waitForFunction(async () => new Promise((res) => {
    const r = indexedDB.open('mara-terrain');
    r.onsuccess = () => {
      const q = r.result.transaction('envois').objectStore('envois').count();
      q.onsuccess = () => { res(q.result === 0); r.result.close(); };
    };
  }), null, { timeout: 20000 });
  let recue = [];
  for (let k = 0; k < 20 && !recue.length; k += 1) {
    recue = await p.evaluate(async (n) => (await fetch(`/api/visites?numeroEssieu=${n}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('mara.token')}` },
    })).json(), essieu);
    if (!recue.length) await p.waitForTimeout(500);
  }
  ok(recue.length === 1 && recue[0].signataire === 'tech.dmat', 'signataire reconnecté : visite envoyée et reçue une fois');
  ok(erreurs.length === 0, `aucune erreur de page ${erreurs.join(' ')}`);
} finally {
  await b.close();
}
