/**
 * Stockage terrain : les visites clôturées et leurs photos restent dans IndexedDB
 * jusqu'à confirmation du serveur. L'identifiant de visite rend le renvoi sans risque.
 *
 * Les visites et les photos sont chiffrées (AES-GCM 256) avec une clé générée sur le
 * terminal et non exportable : le navigateur la garde, mais aucun script ne peut la lire.
 * Sans contexte sécurisé (HTTPS ou localhost), le chiffrement n'est pas disponible et
 * les données restent en clair ; l'écran Mon compte l'indique.
 *
 * Chaque visite garde le compte qui l'a signée : elle n'est envoyée qu'avec ce compte.
 */
import api from '../api/client.js';

const BASE = 'mara-terrain';
export const EVENEMENT = 'mara-envois';

function ouvrir() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('envois')) db.createObjectStore('envois', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
      if (!db.objectStoreNames.contains('cles')) db.createObjectStore('cles');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function operation(store, mode, action) {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = action(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const signaler = () => window.dispatchEvent(new Event(EVENEMENT));

// ── Chiffrement local ──────────────────────────────────────────────────────
export const chiffrementDisponible = () => Boolean(window.crypto?.subtle) && window.isSecureContext;

let clePromesse = null;
function cle() {
  if (!chiffrementDisponible()) return Promise.resolve(null);
  if (!clePromesse) {
    clePromesse = (async () => {
      const existante = await operation('cles', 'readonly', (s) => s.get('principale'));
      if (existante) return existante;
      const nouvelle = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await operation('cles', 'readwrite', (s) => s.put(nouvelle, 'principale'));
      return nouvelle;
    })().catch(() => null);
  }
  return clePromesse;
}

async function chiffrer(valeur) {
  const k = await cle();
  if (!k) return { clair: valeur };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const donnees = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(valeur)));
  return { iv, donnees };
}

async function dechiffrer(enreg) {
  if (enreg == null || typeof enreg !== 'object') return enreg;
  if (enreg.donnees && enreg.iv) {
    const k = await cle();
    if (!k) throw new Error('Clé de chiffrement indisponible sur ce terminal.');
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: enreg.iv }, k, enreg.donnees);
    return JSON.parse(new TextDecoder().decode(clair));
  }
  return 'clair' in enreg ? enreg.clair : enreg;           // donnée en clair (anciennes versions)
}

/** Compte connecté sur ce terminal (dernier profil connu). */
export function compteCourant() {
  try { return JSON.parse(localStorage.getItem('mara.profil'))?.userName || null; } catch { return null; }
}

// ── Photos ─────────────────────────────────────────────────────────────────
export async function garderPhoto(cleP, dataUrl) {
  const enreg = await chiffrer(dataUrl);
  return operation('photos', 'readwrite', (s) => s.put(enreg, cleP));
}
const lirePhoto = async (cleP) => dechiffrer(await operation('photos', 'readonly', (s) => s.get(cleP)));
const oublierPhoto = (cleP) => operation('photos', 'readwrite', (s) => s.delete(cleP));

// ── File d'envoi ───────────────────────────────────────────────────────────
async function lireEnvois() {
  const bruts = await operation('envois', 'readonly', (s) => s.getAll());
  const liste = [];
  for (const b of bruts) {
    try {
      const v = b.chiffre ? await dechiffrer(b.chiffre) : b;
      liste.push({ ...v, id: b.id, compte: b.compte ?? v.compte ?? null, erreur: b.erreur ?? v.erreur ?? null });
    } catch { liste.push({ id: b.id, compte: b.compte, illisible: true }); }
  }
  return liste;
}

async function ecrireEnvoi(visite) {
  const { id, compte, erreur, ...reste } = visite;
  const chiffre = await chiffrer(reste);
  await operation('envois', 'readwrite', (s) => s.put({ id, compte: compte ?? null, erreur: erreur ?? null, chiffre }));
}

/** Visites en attente sur ce terminal (tous comptes). */
export const enAttente = () => lireEnvois();

export async function ajouterEnvoi(visite) {
  await ecrireEnvoi({ ...visite, compte: visite.compte ?? compteCourant(), erreur: null });
  signaler();
}

/** Réduit une photo à 1280 px en JPEG pour tenir sur un réseau faible. */
export function compresserPhoto(fichier) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      const echelle = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * echelle);
      canvas.height = Math.round(image.height * echelle);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Photo illisible.')); };
    image.src = url;
  });
}

let enCours = null;

/** Envoie les visites en attente du compte connecté. S'arrête à la première coupure réseau. */
export function synchroniser() {
  if (!enCours) enCours = envoyer().finally(() => { enCours = null; signaler(); });
  return enCours;
}

async function envoyer() {
  const compte = compteCourant();
  for (const visite of await lireEnvois()) {
    if (visite.illisible) continue;
    // Une visite signée par un autre compte attend que ce compte se reconnecte.
    if (visite.compte && compte && visite.compte !== compte) continue;
    const { erreur, compte: _c, ...corps } = visite;
    const etapes = await Promise.all(corps.etapes.map(async (e) => {
      const photo = e.photo ? await lirePhoto(`${corps.id}:${e.etapeId}`) : null;
      const { photo: _ignore, ...reste } = e;
      return { ...reste, photoBase64: photo ? photo.split(',')[1] : null };
    }));

    try {
      await api.envoyerVisite({ ...corps, etapes });
    } catch (e) {
      if (e instanceof TypeError) return;     // réseau absent : on réessaiera
      await ecrireEnvoi({ ...visite, erreur: e.message });
      continue;
    }

    await operation('envois', 'readwrite', (s) => s.delete(corps.id));
    await Promise.all(corps.etapes.filter((e) => e.photo)
      .map((e) => oublierPhoto(`${corps.id}:${e.etapeId}`)));
    signaler();
  }
}
