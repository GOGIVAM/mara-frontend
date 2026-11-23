/**
 * Sonorisation : trois signaux courts et la lecture des consignes à voix haute.
 * Validation (grave, court), vigilance (deux notes), alerte (trois notes aiguës).
 * Les réglages sont gardés sur le terminal ; tout est désactivable.
 */
const CLE = 'mara.son';
const DEFAUT = { signaux: true, lecture: false, voix: false };

export function lireReglages() {
  try { return { ...DEFAUT, ...JSON.parse(localStorage.getItem(CLE)) }; } catch { return { ...DEFAUT }; }
}

export function ecrireReglages(r) {
  try { localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new Event('mara-son'));
}

let contexte = null;
const audio = () => {
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  if (!contexte) contexte = new C();
  if (contexte.state === 'suspended') contexte.resume().catch(() => {});
  return contexte;
};

const SIGNAUX = {
  validation: [[440, 0.12]],
  vigilance: [[660, 0.12], [520, 0.16]],
  alerte: [[880, 0.1], [880, 0.1], [880, 0.14]],
  clic: [[1200, 0.04]],
};

/** Joue un signal si les signaux sont activés. */
export function signal(nom) {
  if (!lireReglages().signaux) return;
  const ctx = audio();
  const notes = SIGNAUX[nom];
  if (!ctx || !notes) return;
  let t = ctx.currentTime;
  for (const [freq, duree] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duree + 0.02);
    t += duree + 0.05;
  }
}

export const lectureDisponible = () => 'speechSynthesis' in window;

/** Lit un texte en français si la lecture est activée (ou si force est vrai). */
export function lire(texte, force = false) {
  if (!lectureDisponible() || (!force && !lireReglages().lecture) || !texte) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = 'fr-FR';
  u.rate = 1;
  const voix = window.speechSynthesis.getVoices?.().find((v) => v.lang?.startsWith('fr'));
  if (voix) u.voice = voix;
  window.speechSynthesis.speak(u);
}

export const taire = () => { if (lectureDisponible()) window.speechSynthesis.cancel(); };
