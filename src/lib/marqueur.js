/**
 * Lecture des marqueurs QR dans l'image de la caméra.
 * BarcodeDetector (natif sur Android) quand il existe, sinon jsQR (Apache-2.0).
 * Renvoie le texte du marqueur et sa position dans l'image : centre, taille et angle,
 * en proportion de l'image, pour caler la maquette sur le marqueur.
 */
import jsQR from 'jsqr';

let natif;
const detecteurNatif = async () => {
  if (natif !== undefined) return natif;
  natif = null;
  try {
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
      natif = new window.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch { natif = null; }
  return natif;
};

const toile = document.createElement('canvas');
const LARGEUR = 640;

function geometrie(coins, l, h) {
  const [a, b, c, d] = coins;
  const cx = (a.x + b.x + c.x + d.x) / 4 / l;
  const cy = (a.y + b.y + c.y + d.y) / 4 / h;
  const cote = (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y)
    + Math.hypot(d.x - c.x, d.y - c.y) + Math.hypot(a.x - d.x, a.y - d.y)) / 4;
  return { cx, cy, taille: cote / h, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** Lit un marqueur dans une vidéo en cours ; null si aucun n'est visible. */
export async function lireMarqueur(video) {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  const det = await detecteurNatif();
  if (det) {
    try {
      const [r] = await det.detect(video);
      if (r?.cornerPoints?.length === 4) {
        return { texte: r.rawValue, ...geometrie(r.cornerPoints, video.videoWidth, video.videoHeight) };
      }
      return null;
    } catch { /* repli sur jsQR */ }
  }
  const e = Math.min(1, LARGEUR / video.videoWidth);
  toile.width = Math.round(video.videoWidth * e);
  toile.height = Math.round(video.videoHeight * e);
  const ctx = toile.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, toile.width, toile.height);
  const img = ctx.getImageData(0, 0, toile.width, toile.height);
  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  if (!r) return null;
  const { topLeftCorner: a, topRightCorner: b, bottomRightCorner: c, bottomLeftCorner: d } = r.location;
  return { texte: r.data, ...geometrie([a, b, c, d], img.width, img.height) };
}

/** Équipement dont le marqueur correspond au texte lu (comparaison sans casse ni espaces). */
export function equipementDuMarqueur(equipements, texte) {
  const t = (texte || '').trim().toUpperCase();
  return equipements.find((e) => (e.marqueur || '').trim().toUpperCase() === t || e.code.toUpperCase() === t) || null;
}
