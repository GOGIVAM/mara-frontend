// Tests de la logique de démontage sur le manifeste réel de la pompe.
// Lancer : node --test src/lib/scenario.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DEPOSE, DEVISSE, MONTE, appliquer, controlerManifeste, etapeCourante, etatInitial, executerEtape, indexer, phaseApres,
  toutEnPlace, verifier,
} from './scenario.js';

const RACINE = new URL('../../../ma_ra_dotnet/Maquettes/', import.meta.url);
const CATALOGUE = JSON.parse(readFileSync(new URL('catalogue.json', RACINE), 'utf8'));
const lire = (actif) => JSON.parse(readFileSync(new URL(CATALOGUE.actifs.find((a) => a.actif === actif).manifeste, RACINE), 'utf8'));
const pompe = lire('pompe-eau-qsk19');
const idx = indexer(pompe);

test('la volute ne se dépose pas tant que ses vis sont serrées', () => {
  const v = verifier(idx, etatInitial(pompe), 'deposer', 'volute');
  assert.equal(v.ok, false);
  assert.match(v.raison, /Vis de volute/);
});

test('dévisser puis déposer puis reposer puis revisser', () => {
  let etat = etatInitial(pompe);
  for (let k = 1; k <= 6; k += 1) etat = appliquer(idx, etat, 'devisser', `vis_volute_${k}`).etat;
  assert.equal(etat.vis_volute_1, DEVISSE);
  etat = appliquer(idx, etat, 'deposer', 'volute').etat;
  assert.equal(etat.volute, DEPOSE);
  assert.equal(verifier(idx, etat, 'visser', 'vis_volute_1').ok, false, 'pas de vissage sans volute');
  etat = appliquer(idx, etat, 'reposer', 'volute').etat;
  for (let k = 1; k <= 6; k += 1) etat = appliquer(idx, etat, 'visser', `vis_volute_${k}`).etat;
  assert.ok(toutEnPlace(etat));
});

test('la roue se repose avant la volute, pas après', () => {
  let etat = etatInitial(pompe);
  for (const e of pompe.scenario.etapes.slice(0, 4)) etat = executerEtape(idx, etat, e).etat;
  assert.equal(etat.roue, DEPOSE);
  const r = verifier(idx, etat, 'reposer', 'volute');
  assert.equal(r.ok, false);
  assert.match(r.raison, /Roue/);
});

test('le scénario complet revient à l\'état initial', () => {
  let etat = etatInitial(pompe);
  let n = 0;
  let phase = 'demontage';
  while (etapeCourante(pompe.scenario, etat, phase) >= 0 && n < 100) {
    const e = pompe.scenario.etapes[etapeCourante(pompe.scenario, etat, phase)];
    const r = executerEtape(idx, etat, e);
    assert.ok(r.ok, r.raison);
    etat = r.etat;
    phase = phaseApres(pompe.scenario, etat, phase);
    n += 1;
  }
  assert.equal(n, pompe.scenario.etapes.length);
  assert.ok(Object.values(etat).every((e) => e === MONTE));
});

test('chaque manifeste du catalogue respecte le contrat', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../../../ma_ra_dotnet/Maquettes/catalogue.json', import.meta.url), 'utf8'));
  assert.ok(catalogue.actifs.length >= 13);
  for (const a of catalogue.actifs) {
    const m = lire(a.actif);
    assert.deepEqual(controlerManifeste(m), [], a.actif);
    if (!m.scenario) continue;
    let etat = etatInitial(m);
    const ix = indexer(m);
    for (const e of m.scenario.etapes) {
      const r = executerEtape(ix, etat, e);
      assert.ok(r.ok, `${a.actif} ${e.id} : ${r.raison}`);
      etat = r.etat;
    }
    assert.ok(toutEnPlace(etat), `${a.actif} : remontage complet`);
  }
});

test('une boucle de dépendances est détectée', () => {
  const m = { pieces: [{ id: 'a', noeud: 'a', dependances: ['b'] }, { id: 'b', noeud: 'b', dependances: ['a'] }] };
  assert.ok(controlerManifeste(m).some((e) => e.includes('boucle')));
});
