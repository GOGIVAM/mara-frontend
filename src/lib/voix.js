/**
 * Commande vocale par la reconnaissance de la parole du navigateur (Web Speech API).
 * Chrome transmet l'audio au service de reconnaissance de Google : la commande vocale
 * est donc désactivée par défaut et signalée comme telle à l'utilisateur.
 * Le casque RealWear a sa propre commande vocale, à essayer sur l'appareil.
 */
import { useEffect, useRef, useState } from 'react';
import { lireReglages } from './son.js';

const Reconnaissance = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const voixDisponible = () => Boolean(Reconnaissance());

/** Retire accents et ponctuation pour comparer une phrase reconnue aux commandes. */
export const normaliser = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Trouve la commande prononcée. commandes : { cle: ['mot', 'autre formule'] }.
 * La formule la plus longue l'emporte, pour que « étape suivante » passe avant « suivante ».
 */
export function trouverCommande(phrase, commandes) {
  const p = ` ${normaliser(phrase)} `;
  let meilleure = null;
  for (const [cle, formules] of Object.entries(commandes)) {
    for (const f of formules) {
      const n = normaliser(f);
      if (p.includes(` ${n} `) && (!meilleure || n.length > meilleure.longueur)) meilleure = { cle, longueur: n.length };
    }
  }
  return meilleure?.cle || null;
}

/** Écoute les commandes tant que la commande vocale est activée dans Mon compte. */
export function useCommandesVocales(commandes, surCommande) {
  const [etat, setEtat] = useState('arret');      // arret | ecoute | indisponible
  const [entendu, setEntendu] = useState('');
  const rappel = useRef(surCommande);
  rappel.current = surCommande;
  const liste = useRef(commandes);
  liste.current = commandes;
  const [actif, setActif] = useState(() => lireReglages().voix);

  useEffect(() => {
    const maj = () => setActif(lireReglages().voix);
    window.addEventListener('mara-son', maj);
    return () => window.removeEventListener('mara-son', maj);
  }, []);

  useEffect(() => {
    if (!actif) { setEtat('arret'); return undefined; }
    const R = Reconnaissance();
    if (!R) { setEtat('indisponible'); return undefined; }
    const rec = new R();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = false;
    let arrete = false;
    rec.onresult = (e) => {
      const phrase = e.results[e.results.length - 1][0].transcript;
      setEntendu(phrase);
      const cle = trouverCommande(phrase, liste.current);
      if (cle) rappel.current(cle);
    };
    rec.onend = () => { if (!arrete) { try { rec.start(); } catch { /* déjà démarrée */ } } };
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { arrete = true; setEtat('indisponible'); } };
    try { rec.start(); setEtat('ecoute'); } catch { setEtat('indisponible'); }
    return () => { arrete = true; rec.onend = null; try { rec.stop(); } catch { /* arrêtée */ } };
  }, [actif]);

  return { etat, entendu };
}
