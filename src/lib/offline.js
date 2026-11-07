/**
 * Stockage terrain : les visites clôturées et leurs photos restent dans IndexedDB
 * jusqu'à confirmation du serveur. L'identifiant de visite rend le renvoi sans risque.
 */
import api from '../api/client.js';

const BASE = 'mara-terrain';
export const EVENEMENT = 'mara-envois';

function ouvrir() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('envois', { keyPath: 'id' });
      r.result.createObjectStore('photos');
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

export const garderPhoto = (cle, dataUrl) => operation('photos', 'readwrite', (s) => s.put(dataUrl, cle));
const lirePhoto = (cle) => operation('photos', 'readonly', (s) => s.get(cle));
const oublierPhoto = (cle) => operation('photos', 'readwrite', (s) => s.delete(cle));

export const enAttente = () => operation('envois', 'readonly', (s) => s.getAll());

export async function ajouterEnvoi(visite) {
  await operation('envois', 'readwrite', (s) => s.put({ ...visite, erreur: null }));
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

/** Envoie les visites en attente. S'arrête à la première coupure réseau. */
export function synchroniser() {
  if (!enCours) enCours = envoyer().finally(() => { enCours = null; signaler(); });
  return enCours;
}

async function envoyer() {
  for (const visite of await enAttente()) {
    const { erreur, ...corps } = visite;
    const etapes = await Promise.all(corps.etapes.map(async (e) => {
      const photo = e.photo ? await lirePhoto(`${corps.id}:${e.etapeId}`) : null;
      const { photo: _ignore, ...reste } = e;
      return { ...reste, photoBase64: photo ? photo.split(',')[1] : null };
    }));

    try {
      await api.envoyerVisite({ ...corps, etapes });
    } catch (e) {
      if (e instanceof TypeError) return;     // réseau absent : on réessaiera
      await operation('envois', 'readwrite', (s) => s.put({ ...visite, erreur: e.message }));
      continue;
    }

    await operation('envois', 'readwrite', (s) => s.delete(corps.id));
    await Promise.all(corps.etapes.filter((e) => e.photo)
      .map((e) => oublierPhoto(`${corps.id}:${e.etapeId}`)));
    signaler();
  }
}
