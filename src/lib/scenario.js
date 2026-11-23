/**
 * Démontage virtuel : état de chaque pièce et règles de montage tirées du manifeste.
 * monte → (fixation) devisse → depose ; une pièce se dépose quand ses fixations sont
 * dévissées et que les pièces qui la couvrent (dépendances) sont déposées.
 * Fonctions pures : aucun accès à la scène 3D.
 */
export const MONTE = 'monte';
export const DEVISSE = 'devisse';
export const DEPOSE = 'depose';

const VERBES = {
  devisser: 'dévisser', visser: 'visser', deposer: 'déposer', reposer: 'reposer',
};

/** Index des relations du manifeste. */
export function indexer(manifeste) {
  const pieces = new Map(manifeste.pieces.map((p) => [p.id, p]));
  const fixations = new Map();      // pièce → vis qui la tiennent
  const dependants = new Map();     // pièce → pièces qui exigent sa dépose avant la leur
  for (const p of manifeste.pieces) {
    if (p.fixe) fixations.set(p.fixe, [...(fixations.get(p.fixe) || []), p.id]);
    for (const d of p.dependances || []) dependants.set(d, [...(dependants.get(d) || []), p.id]);
  }
  return { pieces, fixations, dependants };
}

export const etatInitial = (manifeste) => Object.fromEntries(manifeste.pieces.map((p) => [p.id, MONTE]));

const nom = (idx, id) => idx.pieces.get(id)?.nom || id;
const estFixation = (idx, id) => Boolean(idx.pieces.get(id)?.fixation);

/** Une dépendance est levée quand la vis est au moins dévissée, ou quand la pièce est déposée. */
function levee(idx, etat, id) {
  return estFixation(idx, id) ? etat[id] !== MONTE : etat[id] === DEPOSE;
}

/** Vérifie une action ; renvoie { ok, raison }. */
export function verifier(idx, etat, action, id) {
  const p = idx.pieces.get(id);
  if (!p) return { ok: false, raison: 'Pièce inconnue.' };
  const e = etat[id];
  const fixation = Boolean(p.fixation);
  const bloquantes = () => (p.dependances || []).filter((d) => !levee(idx, etat, d))
    .concat((idx.fixations.get(id) || []).filter((v) => etat[v] === MONTE));
  switch (action) {
    case 'devisser':
      if (!fixation) return { ok: false, raison: `${p.nom} n'est pas une fixation.` };
      if (e !== MONTE) return { ok: false, raison: `${p.nom} est déjà dévissée.` };
      return { ok: true };
    case 'visser':
      if (!fixation) return { ok: false, raison: `${p.nom} n'est pas une fixation.` };
      if (e !== DEVISSE) return { ok: false, raison: e === DEPOSE ? `Reposez d'abord ${p.nom}.` : `${p.nom} est déjà vissée.` };
      if (p.fixe && etat[p.fixe] !== MONTE) return { ok: false, raison: `Reposez d'abord ${nom(idx, p.fixe)}.` };
      return { ok: true };
    case 'deposer': {
      if (e === DEPOSE) return { ok: false, raison: `${p.nom} est déjà déposée.` };
      if (fixation && e === MONTE) return { ok: false, raison: `Dévissez d'abord ${p.nom}.` };
      const restent = bloquantes();
      if (restent.length) {
        return { ok: false, raison: `Avant de déposer ${p.nom} : ${restent.map((r) => nom(idx, r)).join(', ')}.` };
      }
      return { ok: true };
    }
    case 'reposer': {
      if (e !== DEPOSE) return { ok: false, raison: `${p.nom} est en place.` };
      const avant = (idx.dependants.get(id) || []).filter((d) => etat[d] === DEPOSE);
      if (avant.length) {
        return { ok: false, raison: `Reposez d'abord : ${avant.map((r) => nom(idx, r)).join(', ')}.` };
      }
      const genantes = (p.dependances || []).filter((d) => !estFixation(idx, d) && etat[d] !== DEPOSE);
      if (genantes.length) {
        return { ok: false, raison: `Déposez d'abord : ${genantes.map((r) => nom(idx, r)).join(', ')}.` };
      }
      return { ok: true };
    }
    default:
      return { ok: false, raison: `Action inconnue : ${action}.` };
  }
}

const SUIVANT = { devisser: DEVISSE, visser: MONTE, deposer: DEPOSE };

/** Applique une action vérifiée. */
export function appliquer(idx, etat, action, id) {
  const v = verifier(idx, etat, action, id);
  if (!v.ok) return { etat, ...v };
  const nouvel = action === 'reposer'
    ? (estFixation(idx, id) ? DEVISSE : MONTE)
    : SUIVANT[action];
  return { etat: { ...etat, [id]: nouvel }, ok: true };
}

/** Actions possibles pour une pièce, dans l'ordre d'affichage. */
export function actionsPossibles(idx, etat, id) {
  return ['devisser', 'deposer', 'reposer', 'visser']
    .map((a) => ({ action: a, libelle: VERBES[a], ...verifier(idx, etat, a, id) }))
    .filter((a) => a.ok || (a.action === 'deposer' && etat[id] !== DEPOSE && !idx.pieces.get(id)?.fixation));
}

/** Une étape de scénario est faite quand chacune de ses pièces a atteint l'état visé. */
export function etapeFaite(etape, etat) {
  return etape.pieces.every((id) => {
    if (etape.action === 'devisser') return etat[id] !== MONTE;
    if (etape.action === 'deposer') return etat[id] === DEPOSE;
    if (etape.action === 'reposer') return etat[id] !== DEPOSE;
    return etat[id] === MONTE;
  });
}

const DEMONTAGE = new Set(['devisser', 'deposer']);
export const estDemontage = (etape) => DEMONTAGE.has(etape.action);

/**
 * Première étape non faite de la phase en cours (« demontage » ou « remontage »).
 * Renvoie -1 quand le remontage est terminé.
 */
export function etapeCourante(scenario, etat, phase = 'demontage') {
  if (!scenario) return -1;
  const cherche = (demontage) => scenario.etapes.findIndex((e) => estDemontage(e) === demontage && !etapeFaite(e, etat));
  if (phase === 'demontage') {
    const i = cherche(true);
    if (i >= 0) return i;
  }
  return cherche(false);
}

/** La phase passe au remontage quand toutes les étapes de démontage sont faites. */
export function phaseApres(scenario, etat, phase) {
  if (!scenario) return phase;
  if (phase === 'demontage' && scenario.etapes.filter(estDemontage).every((e) => etapeFaite(e, etat))) return 'remontage';
  return phase;
}

/** Exécute une étape de scénario : chaque pièce non encore traitée reçoit l'action. */
export function executerEtape(idx, etat, etape) {
  let courant = etat;
  for (const id of etape.pieces) {
    const deja = etapeFaite({ ...etape, pieces: [id] }, courant);
    if (deja) continue;
    const r = appliquer(idx, courant, etape.action, id);
    if (!r.ok) return { etat, ok: false, raison: r.raison };
    courant = r.etat;
  }
  return { etat: courant, ok: true };
}

export const toutEnPlace = (etat) => Object.values(etat).every((e) => e === MONTE);

/** Vérifie le contrat du manifeste côté client : nœuds présents, identifiants uniques, dépendances sans boucle. */
export function controlerManifeste(manifeste, noeuds) {
  const erreurs = [];
  const ids = manifeste.pieces.map((p) => p.id);
  const vus = new Set();
  for (const id of ids) {
    if (vus.has(id)) erreurs.push(`identifiant dupliqué : ${id}`);
    vus.add(id);
  }
  if (noeuds) {
    for (const p of manifeste.pieces) if (!noeuds.has(p.noeud)) erreurs.push(`nœud absent du GLB : ${p.noeud}`);
  }
  const graphe = new Map(manifeste.pieces.map((p) => [p.id, new Set(p.dependances || [])]));
  for (const p of manifeste.pieces) if (p.fixe && graphe.has(p.fixe)) graphe.get(p.fixe).add(p.id);
  const marque = new Map();
  const visiter = (n) => {
    marque.set(n, 1);
    for (const s of graphe.get(n) || []) {
      if (marque.get(s) === 1) { erreurs.push(`dépendances en boucle autour de ${s}`); return; }
      if (!marque.get(s)) visiter(s);
    }
    marque.set(n, 2);
  };
  for (const n of graphe.keys()) if (!marque.get(n)) visiter(n);
  return erreurs;
}
