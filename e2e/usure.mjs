// Limites, suivi de l'usure, blocage et décision de l'expert dans le dossier d'un essieu.
// Prérequis : API (5080) en Development, vite preview (5199). Usage : node e2e/usure.mjs [captures]
// Crée une gamme de test (supprimée à la fin) et laisse un essieu de test préfixé E2E-USURE-.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const U = process.env.MARA_URL || 'http://localhost:5199';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];
const graine = readFileSync(new URL('../../ma_ra_dotnet/Data/DbInitializer.cs', import.meta.url), 'utf8');
const mdp = (u) => graine.match(new RegExp(`\\("${u.replace('.', '\\.')}",\\s+"[^"]+",\\s+"([^"]+)"`))[1];
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log('OK', m); };

async function connecter(b, utilisateur) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  p.erreurs = [];
  p.on('pageerror', (e) => p.erreurs.push(String(e).slice(0, 200)));
  await p.goto(`${U}/`);
  await p.fill('.login-card input >> nth=0', utilisateur);
  await p.fill('input[type=password]', mdp(utilisateur));
  await p.click('.login-card button.primary-btn');
  await p.waitForSelector('.side-nav');
  p.api = (chemin, methode = 'GET', corps) => p.evaluate(async ([c, m, b]) => {
    const r = await fetch(`/api${c}`, {
      method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('mara.token')}` },
      body: b ? JSON.stringify(b) : undefined,
    });
    const t = await r.text();
    return { statut: r.status, corps: t ? JSON.parse(t) : null };
  }, [chemin, methode, corps]);
  return p;
}

const b = await chromium.launch({ executablePath: CHROME });
const essieu = `E2E-USURE-${Date.now() % 1000000}`;
let gammeId;
try {
  // 1. Gamme de test avec limites
  const a = await connecter(b, 'admin');
  const g = await a.api('/gammes', 'POST', { code: essieu, titre: 'Essai usure', classeEquipement: 'bogie_essieux', direction: 'DMAT', isActive: true });
  ok(g.statut === 201 || g.statut === 200, `gamme de test créée (${g.statut})`);
  gammeId = g.corps.id;
  const e1 = await a.api(`/gammes/${gammeId}/etapes`, 'POST', { ordreIndex: 1, description: 'Mesurer le diamètre de roue', niveauSecurite: 'NONE', limiteMin: 840, limiteMax: 920, unite: 'mm' });
  const e2 = await a.api(`/gammes/${gammeId}/etapes`, 'POST', { ordreIndex: 2, description: 'Contrôler la boîte', niveauSecurite: 'NONE' });
  ok(e1.corps.limiteMin === 840 && e1.corps.unite === 'mm', 'étape : limites et unité enregistrées');
  const gamme = (await a.api(`/gammes/${gammeId}`)).corps;
  await a.context().close();

  // 2. Quatre visites : usure régulière, puis une mesure hors limites déclarée conforme
  const t = await connecter(b, 'tech.dmat');
  const jour = 86400000;
  const maintenant = Date.now();
  const visites = [[-300, '905'], [-200, '895,5'], [-100, '886 mm'], [0, '838']];
  let derniere;
  for (const [decalage, mesure] of visites) {
    const date = new Date(maintenant + decalage * jour - 3600000).toISOString();
    const id = crypto.randomUUID();
    const r = await t.api('/visites', 'POST', {
      id, numeroEssieu: essieu, gammeId, gammeVersion: gamme.version, debutAt: date, clotureAt: date, signataire: 'tech.dmat',
      etapes: [
        { etapeId: e1.corps.id, ordre: 1, description: 'Mesurer le diamètre de roue', resultat: 'conforme', mesure, realiseeAt: date },
        { etapeId: e2.corps.id, ordre: 2, description: 'Contrôler la boîte', resultat: 'conforme', realiseeAt: date },
      ],
    });
    ok(r.statut === 201, `visite à J${decalage} reçue (${mesure})`);
    derniere = id;
  }
  const detail = (await t.api(`/visites/${derniere}`)).corps;
  ok(detail.etapes[0].horsLimites === true && detail.nombreEcarts === 1, 'serveur : 838 mm hors limites compté comme écart');
  ok(detail.versionConforme === true, 'serveur : version de gamme vérifiée à la réception');

  // 3. Dossier de l'essieu : courbe, tendance, blocage
  await t.goto(`${U}/essieux/${essieu}`);
  await t.waitForSelector('.serie svg');
  ok(await t.locator('.serie-point').count() === 4, 'dossier : quatre relevés tracés');
  ok(await t.locator('.serie-limite').count() === 2, 'dossier : limites min et max tracées');
  const texte = await t.textContent('.serie');
  ok(texte.includes('déjà sous la limite minimale') && /Tendance : -?[\d,  ]+ mm par an/.test(texte), 'dossier : limite minimale signalée comme franchie, avec la tendance');
  ok(texte.includes('1 hors limites'), 'dossier : relevé hors limites signalé');
  ok((await t.textContent('.badge')).includes('Bloqué'), "dossier : essieu bloqué après l'écart");
  ok((await t.textContent('.decision')).includes('expert habilité'), 'dossier : technicien sans droit de décision');
  if (OUT) await t.screenshot({ path: `${OUT}/dossier_bloque.png`, fullPage: true });
  const refus = await t.api(`/essieux/${essieu}/decisions`, 'POST', { visiteId: derniere, decision: 'REMISE_EN_SERVICE', motif: 'Essai sans droit' });
  ok(refus.statut === 403, `serveur : décision refusée au technicien (${refus.statut})`);
  ok(t.erreurs.length === 0, `aucune erreur de page ${t.erreurs.join(' ')}`);
  await t.context().close();

  // 4. Décision de l'expert
  const c = await connecter(b, 'coordinateur');
  await c.goto(`${U}/essieux/${essieu}`);
  await c.waitForSelector('.decision form');
  await c.selectOption('.decision select', 'A_REPARER');
  await c.fill('.decision textarea', 'Diamètre sous la limite : reprofilage ou remplacement de la roue.');
  await c.click('text=Enregistrer la décision');
  await c.waitForSelector('text=Décision enregistrée.');
  await c.waitForFunction(() => document.querySelector('.badge')?.textContent.includes('Hors service'));
  ok(true, "décision : l'essieu passe hors service");
  ok((await c.textContent('.visites-liste')).includes('À réparer'), 'décision : motif et décideur historisés');
  if (OUT) await c.screenshot({ path: `${OUT}/dossier_decision.png`, fullPage: true });
  ok(c.erreurs.length === 0, `aucune erreur de page ${c.erreurs.join(' ')}`);
  await c.context().close();
} finally {
  if (gammeId) {
    const a = await connecter(b, 'admin');
    await a.api(`/gammes/${gammeId}`, 'DELETE');
    await a.context().close();
  }
  await b.close();
}
