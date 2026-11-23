/**
 * Catalogue des maquettes : résolution depuis une fiche, une gamme ou une reconnaissance,
 * chargement authentifié, contrôle d'intégrité SHA-256 et copie hors ligne (Cache Storage).
 */
import api from '../api/client.js';

const CACHE = 'mara-maquettes-v1';
const CLE_CATALOGUE = 'catalogue.json';

const ouvrirCache = () => ('caches' in window ? caches.open(CACHE) : Promise.resolve(null));
const cleCache = (chemin) => new URL(api.urlMaquette(chemin), window.location.origin).href;

async function lireCache(chemin) {
  const cache = await ouvrirCache();
  const r = await cache?.match(cleCache(chemin));
  return r ? r.arrayBuffer() : null;
}

async function ecrireCache(chemin, donnees, type) {
  const cache = await ouvrirCache();
  await cache?.put(cleCache(chemin), new Response(donnees, { headers: { 'Content-Type': type } }));
}

/** Empreinte SHA-256 ; null si le contexte n'est pas sécurisé (crypto.subtle absent). */
export async function empreinte(donnees) {
  if (!window.crypto?.subtle) return null;
  const h = await crypto.subtle.digest('SHA-256', donnees);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Catalogue depuis l'API, ou sa dernière copie sans réseau. */
export async function chargerCatalogue() {
  try {
    const catalogue = await api.maquettes();
    ecrireCache(CLE_CATALOGUE, JSON.stringify(catalogue), 'application/json').catch(() => {});
    return { catalogue, horsLigne: false };
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    const copie = await lireCache(CLE_CATALOGUE).catch(() => null);
    if (!copie) throw new Error('Catalogue des maquettes indisponible sans réseau : préparez la visite hors ligne.');
    return { catalogue: JSON.parse(new TextDecoder().decode(copie)), horsLigne: true };
  }
}

/** Maquette d'un équipement : identifiant d'actif, puis code équipement, puis maquette par défaut de la classe. */
export function resoudre(catalogue, { actif, code, classe } = {}) {
  const liste = catalogue?.actifs || [];
  return (actif && liste.find((a) => a.actif === actif))
    || (code && liste.find((a) => a.codes?.includes(code)))
    || (classe && liste.find((a) => a.classe === classe && a.defautClasse))
    || null;
}

/**
 * Fichier versionné : la copie locale sert si son empreinte est bonne, sinon le réseau.
 * Une version publiée n'est jamais réécrite côté serveur.
 */
async function fichier(chemin, sha, type) {
  const local = await lireCache(chemin).catch(() => null);
  if (local) {
    const h = await empreinte(local);
    if (!h || !sha || h === sha) return { donnees: local, integrite: h ? 'verifiee' : 'non_verifiable', source: 'cache' };
  }
  let donnees;
  try {
    donnees = await api.fichierMaquette(chemin);
  } catch (e) {
    if (e instanceof TypeError) throw new Error("Cette maquette n'a pas été préparée pour la consultation hors ligne.");
    throw e;
  }
  const h = await empreinte(donnees);
  if (h && sha && h !== sha) throw new Error(`Fichier ${chemin} altéré : empreinte différente du catalogue.`);
  await ecrireCache(chemin, donnees.slice(0), type).catch(() => {});
  return { donnees, integrite: h ? 'verifiee' : 'non_verifiable', source: 'reseau' };
}

/** Manifeste et GLB d'une entrée du catalogue. */
export async function chargerMaquette(entree) {
  const m = await fichier(entree.manifeste, entree.manifesteSha256, 'application/json');
  const manifeste = JSON.parse(new TextDecoder().decode(m.donnees));
  const g = await fichier(entree.glb, entree.sha256, 'model/gltf-binary');
  return { manifeste, glb: g.donnees, integrite: g.integrite === 'verifiee' && m.integrite === 'verifiee' ? 'verifiee' : 'non_verifiable' };
}

/** Quelles maquettes sont utilisables sans réseau, avec leur version. */
export async function etatHorsLigne(catalogue) {
  const resultat = {};
  for (const a of catalogue?.actifs || []) {
    const [m, g] = await Promise.all([lireCache(a.manifeste), lireCache(a.glb)]).catch(() => [null, null]);
    if (!m || !g) { resultat[a.actif] = 'absente'; continue; }
    const [hm, hg] = await Promise.all([empreinte(m), empreinte(g)]);
    resultat[a.actif] = !hm ? 'presente' : (hm === a.manifesteSha256 && hg === a.sha256 ? 'integre' : 'alteree');
  }
  return resultat;
}

/** Télécharge à l'avance les maquettes indiquées (toutes par défaut). */
export async function preparerHorsLigne(catalogue, actifs, progression) {
  const liste = (catalogue?.actifs || []).filter((a) => !actifs || actifs.includes(a.actif));
  await ecrireCache(CLE_CATALOGUE, JSON.stringify(catalogue), 'application/json');
  let n = 0;
  for (const a of liste) {
    await chargerMaquette(a);
    n += 1;
    progression?.(n, liste.length);
  }
  return n;
}

/** Lien d'étape de gamme : « maquette:<actif>?piece=<pièce>&vue=<vue> ». */
export function lireRef(ref) {
  const m = /^maquette:([a-z0-9-]+)(?:\?(.*))?$/.exec(ref || '');
  if (!m) return null;
  const q = new URLSearchParams(m[2] || '');
  return { actif: m[1], piece: q.get('piece'), vue: q.get('vue') };
}

/** Adresse de la page maquette ; les paramètres absents sont omis. */
export function lienMaquette(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
  return `/modele?${q}`;
}

/**
 * Nomenclature numérotée : un repère par organe, dans l'ordre du manifeste.
 * Les fixations d'une même série partagent un repère.
 */
export function nomenclature(manifeste) {
  const groupes = new Map();
  for (const p of manifeste?.pieces || []) {
    if (p.selectionnable === false) continue;
    const cle = p.organe || p.id;
    if (!groupes.has(cle)) {
      const nom = manifeste.organes?.[cle] || (p.fixe ? p.nom.replace(/\s+\d+$/, '') : p.nom);
      groupes.set(cle, { organe: cle, nom, pieces: [] });
    }
    groupes.get(cle).pieces.push(p.id);
  }
  return [...groupes.values()].map((g, i) => ({ ...g, numero: i + 1 }));
}

export const STATUTS = {
  cotes_plan: { libelle: 'Cotes de plan', classe: 'statut-plan' },
  illustratif: { libelle: 'Illustratif', classe: 'statut-illustratif' },
  coupe_de_principe: { libelle: 'Coupe de principe', classe: 'statut-principe' },
};

export const STATUTS_COTE = { plan: 'Plan', brochure: 'Brochure', hypothese: 'Hypothèse' };

/** Capacités du terminal pour la caméra et la RA suivie. */
export async function capacitesTerminal() {
  const xr = navigator.xr;
  let immersiveAr = false;
  try { immersiveAr = Boolean(await xr?.isSessionSupported?.('immersive-ar')); } catch { immersiveAr = false; }
  return {
    https: window.isSecureContext,
    camera: Boolean(navigator.mediaDevices?.getUserMedia),
    webxr: Boolean(xr),
    immersiveAr,
  };
}
