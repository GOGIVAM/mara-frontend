// Parcours terrain : validation d'une gamme, visite guidée, traçabilité et hors-ligne.
// Prérequis : API (5080, mode Development), vite preview (5199) d'un build à jour.
// Usage : node e2e/terrain.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const U = process.env.MARA_URL || 'http://localhost:5199';
const API = process.env.MARA_API || 'http://localhost:5080/api';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PHOTO = fileURLToPath(new URL('../public/demo/gros-plan-boite.jpg', import.meta.url));
const graine = new URL('../../ma_ra_dotnet/Data/DbInitializer.cs', import.meta.url);
const mdp = (nom) => readFileSync(graine, 'utf8').match(new RegExp(`\\("${nom.replace('.', '\\.')}",\\s+"[^"]+",\\s+"([^"]+)"`))[1];
const ok = (c, m) => { if (!c) throw new Error(m); console.log('OK', m); };

async function jeton(nom) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: nom, password: mdp(nom) }),
  });
  if (r.status === 429) throw new Error("Limite de l'API atteinte (10 connexions par minute) : relancer dans une minute.");
  return (await r.json()).accessToken;
}
const appel = (t, chemin, { method = 'GET', body } = {}) => fetch(API + chemin, {
  method,
  headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

async function connecter(navigateur, nom) {
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await page.goto(`${U}/`);
  await page.waitForSelector('.login-card');
  await page.fill('.login-card input >> nth=0', nom);
  await page.fill('input[type=password]', mdp(nom));
  await page.click('.login-card button.primary-btn');
  await page.waitForSelector('.side-nav');
  return { ctx, page, erreurs };
}

const alerte = (p) => p.locator('.etape-courante [role=alert]').textContent();

/** Déroule toutes les étapes. Avec `controles`, vérifie aussi les garde-fous de saisie. */
async function parcourir(p, { controles = false, ecart = -1, photo = -1 } = {}) {
  for (let i = 0; await p.locator('.etape-courante').count(); i += 1) {
    const titre = await p.locator('.etape-courante h2').textContent();
    const rouge = await p.locator('.confirmation-securite input').count();
    const mesure = await p.locator('#mesure-1').count();

    if (controles && rouge) {
      await p.click('text=Étape conforme');
      ok((await alerte(p)).includes('Confirmez la consigne'), `étape rouge bloquée sans confirmation (« ${titre} »)`);
    }
    if (rouge) await p.check('.confirmation-securite input');

    if (mesure) {
      if (controles) {
        await p.fill('#mesure-1', '12');
        await p.fill('#mesure-2', '13');
        await p.click('text=Étape conforme');
        ok((await alerte(p)).includes('diffèrent'), 'double saisie de mesure contrôlée');
      }
      await p.fill('#mesure-1', '12');
      await p.fill('#mesure-2', '12');
    }

    if (i === photo) {
      await p.setInputFiles('#photo-etape', PHOTO);
      await p.waitForSelector('text=Photo sélectionnée');
    }

    if (i === ecart) {
      if (controles) {
        await p.click('text=Écart ou doute');
        ok((await alerte(p)).includes("Décrivez l'écart"), 'écart refusé sans observation');
      }
      await p.fill('#note-etape', 'Écart de test');
      await p.click('text=Écart ou doute');
    } else {
      await p.click('text=Étape conforme');
    }
    await p.waitForFunction((t) => document.querySelector('.etape-courante h2')?.textContent !== t, titre);
  }
  await p.waitForSelector('.bilan');
}

async function signer(p) {
  ok((await p.inputValue('#signature')) !== '', 'signature préremplie avec le compte connecté');
  await p.click('text=Signer et clôturer');
  await p.waitForSelector('.tampon');
  return p.evaluate(() => JSON.parse(localStorage.getItem('mara.demo.t17.suivi')).id);
}

async function attendreVisite(t, id, delai = 15000) {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const r = await appel(t, `/visites/${id}`);
    if (r.ok) return r.json();
    await new Promise((f) => setTimeout(f, 500));
  }
  return null;
}

const navigateur = await chromium.launch({ executablePath: CHROME });
const tAdmin = await jeton('admin');
const tTech = await jeton('tech.dmat');
let gammeTest = null;
try {
  // ── 1. Validation d'une gamme ──────────────────────────────────────────
  const code = `E2E-${Date.now()}`;
  gammeTest = await (await appel(tAdmin, '/gammes', {
    method: 'POST',
    body: { code, titre: 'Gamme de test automatique', classeEquipement: 'bogie_essieux', direction: 'DMAT', isActive: true },
  })).json();
  await appel(tAdmin, `/gammes/${gammeTest.id}/etapes`, {
    method: 'POST', body: { ordreIndex: 1, description: 'Étape de test', niveauSecurite: 'NONE' },
  });
  ok(gammeTest.statut !== 'VALIDEE', 'gamme créée en brouillon');

  const refus = await appel(tTech, `/gammes/${gammeTest.id}/valider`, { method: 'POST', body: { sourceDocument: 'x' } });
  ok(refus.status === 403, `un technicien ne peut pas valider (HTTP ${refus.status})`);
  const passee = await appel(tAdmin, `/gammes/${gammeTest.id}/valider`, {
    method: 'POST', body: { sourceDocument: 'x', expireAt: '2020-01-01T00:00:00Z' },
  });
  ok(passee.status === 400, `date d'expiration passée refusée (HTTP ${passee.status})`);

  const admin = await connecter(navigateur, 'admin');
  await admin.page.goto(`${U}/gammes`);
  await admin.page.click(`tr:has-text("${code}")`);
  await admin.page.waitForSelector('text=Brouillon : à valider avant usage');
  await admin.page.fill('.validation-gamme input', 'Document de test, page 1');
  await admin.page.click('.validation-gamme button');
  await admin.page.waitForSelector('text=Validée par admin');
  const validee = await (await appel(tAdmin, `/gammes/${gammeTest.id}`)).json();
  ok(validee.statut === 'VALIDEE' && validee.validePar === 'admin' && validee.sourceDocument === 'Document de test, page 1',
    'validation enregistrée avec son auteur et sa source');
  await appel(tAdmin, `/gammes/${gammeTest.id}`, {
    method: 'PUT',
    body: { code, titre: 'Gamme de test modifiée', classeEquipement: 'bogie_essieux', direction: 'DMAT', isActive: true },
  });
  const modifiee = await (await appel(tAdmin, `/gammes/${gammeTest.id}`)).json();
  ok(modifiee.statut !== 'VALIDEE' && modifiee.version > validee.version,
    `modification : retour en brouillon et nouvelle version (v${validee.version} → v${modifiee.version})`);
  ok(admin.erreurs.length === 0, `aucune erreur de page (admin) ${admin.erreurs.join(' ')}`);
  await admin.ctx.close();

  // ── 2. Visite guidée en ligne ──────────────────────────────────────────
  const tech = await connecter(navigateur, 'tech.dmat');
  const p = tech.page;
  await p.goto(`${U}/intervention`);
  await p.waitForSelector('.intervention-debut');
  ok(await p.locator('text=Gamme non validée').count() === 1, 'bandeau sur la gamme T17 non validée');
  const numero = `E2E-${Date.now()}`;
  await p.fill('#numero-essieu', numero);
  await p.click('text=Démarrer la visite');
  await parcourir(p, { controles: true, ecart: 6, photo: 4 });
  ok(await p.locator('.bilan-alerte').count() === 1, "bilan : essieu signalé à ne pas remettre en service");
  const id = await signer(p);

  // ── 3. Traçabilité côté serveur ────────────────────────────────────────
  const v = await attendreVisite(tTech, id);
  ok(v !== null, 'visite reçue par le serveur');
  ok(v.numeroEssieu === numero && v.gammeCode === 'GESS-T17-DEMO' && v.gammeVersion >= 1,
    'essieu, gamme et version enregistrés');
  ok(v.signataire === 'tech.dmat', 'signataire enregistré');
  ok(v.etapes.length === 10 && v.etapes.every((e) => e.realiseeAt), 'dix étapes horodatées');
  ok(v.nombreEcarts === 1 && v.etapes.some((e) => e.resultat === 'ecart' && e.note === 'Écart de test'), 'écart et observation conservés');
  ok(v.etapes.some((e) => e.mesure === '12'), 'mesure conservée');
  const avecPhoto = v.etapes.find((e) => e.photo);
  const photo = avecPhoto && await appel(tTech, `/visites/${id}/etapes/${avecPhoto.etapeId}/photo`);
  ok(photo?.status === 200 && photo.headers.get('content-type') === 'image/jpeg', 'photo récupérable');

  const t17 = (await (await appel(tTech, '/gammes')).json()).find((g) => g.code === 'GESS-T17-DEMO');
  const renvoi = await (await appel(tTech, '/visites', {
    method: 'POST',
    body: {
      id, numeroEssieu: 'FALSIFIE', gammeId: t17.id, gammeVersion: 1, signataire: 'autre',
      debutAt: v.debutAt, clotureAt: v.clotureAt,
      etapes: [{ etapeId: v.etapes[0].etapeId, ordre: 1, description: 'x', resultat: 'conforme', realiseeAt: v.debutAt }],
    },
  })).json();
  const apres = await (await appel(tTech, `/visites/${id}`)).json();
  ok(renvoi.deja === true && apres.numeroEssieu === numero && apres.signataire === 'tech.dmat',
    'un renvoi du même identifiant ne modifie pas la visite');

  await p.click('text=Nouvelle visite');
  await p.fill('#numero-essieu', numero);
  await p.click('text=Démarrer la visite');
  await p.waitForSelector('text=1 visite(s) précédente(s)');
  ok(true, "historique de l'essieu affiché à la visite suivante");
  await p.evaluate(() => localStorage.removeItem('mara.demo.t17.suivi'));
  ok(tech.erreurs.length === 0, `aucune erreur de page (visite) ${tech.erreurs.join(' ')}`);
  await tech.ctx.close();

  // ── 4. Visite hors ligne puis envoi au retour du réseau ────────────────
  const terrain = await connecter(navigateur, 'tech.dmat');
  const q = terrain.page;
  await q.goto(`${U}/intervention`);
  await q.waitForSelector('.intervention-debut');
  await q.evaluate(() => navigator.serviceWorker.ready);
  await q.reload();
  await q.waitForSelector('.intervention-debut');
  ok(await q.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'application en cache sur le terminal');

  // L'émulation hors ligne peut laisser passer une requête juste après un rechargement :
  // on coupe aussi l'API au niveau du navigateur.
  const couper = (route) => route.abort('internetdisconnected');
  await terrain.ctx.route('**/api/**', couper);
  await terrain.ctx.setOffline(true);
  const numeroHorsLigne = `E2E-HL-${Date.now()}`;
  await q.fill('#numero-essieu', numeroHorsLigne);
  await q.click('text=Démarrer la visite');
  await parcourir(q);
  const idHorsLigne = await signer(q);
  await q.waitForSelector('.statut-reseau:has-text("1 à envoyer")');
  ok((await q.textContent('.statut-reseau:has-text("à envoyer")')).includes('Hors ligne'), 'visite clôturée sans réseau, en attente');

  await q.reload();
  await q.waitForSelector('.statut-reseau:has-text("1 à envoyer")');
  ok(await q.locator('.tampon').count() === 1, 'page rechargée sans réseau : compte rendu et file conservés');
  ok((await appel(tTech, `/visites/${idHorsLigne}`)).status === 404, "le serveur n'a encore rien reçu");

  const envois = [];
  q.on('response', async (r) => {
    if (r.url().endsWith('/api/visites') && r.request().method() === 'POST') envois.push(`${r.status()} ${await r.text().catch(() => '')}`);
  });
  await terrain.ctx.unroute('**/api/**', couper);
  await terrain.ctx.setOffline(false);
  await q.waitForSelector('.statut-reseau:has-text("à envoyer")', { state: 'detached', timeout: 15000 })
    .catch((e) => { throw new Error(`file non vidée ; réponses du serveur : ${envois.join(' | ') || 'aucune'} ; ${e.message.split('\n')[0]}`); });
  const recue = await attendreVisite(tTech, idHorsLigne);
  ok(recue?.numeroEssieu === numeroHorsLigne && recue.etapes.length === 10, 'visite envoyée seule au retour du réseau');
  await q.evaluate(() => localStorage.removeItem('mara.demo.t17.suivi'));
  ok(terrain.erreurs.length === 0, `aucune erreur de page (hors ligne) ${terrain.erreurs.join(' ')}`);
} finally {
  if (gammeTest?.id) await appel(tAdmin, `/gammes/${gammeTest.id}`, { method: 'DELETE' });
  await navigateur.close();
}
