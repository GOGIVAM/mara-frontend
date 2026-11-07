import { useEffect, useState } from 'react';
import { EVENEMENT, enAttente, synchroniser } from '../lib/offline.js';

/** Indique le réseau et le nombre de visites qui attendent d'être envoyées. */
export default function StatutReseau() {
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [attente, setAttente] = useState(0);

  useEffect(() => {
    const compter = () => enAttente().then((l) => setAttente(l.length)).catch(() => {});
    const connecte = () => { setEnLigne(true); synchroniser(); };
    const coupe = () => setEnLigne(false);
    window.addEventListener('online', connecte);
    window.addEventListener('offline', coupe);
    window.addEventListener(EVENEMENT, compter);
    compter();
    if (navigator.onLine) synchroniser();
    return () => {
      window.removeEventListener('online', connecte);
      window.removeEventListener('offline', coupe);
      window.removeEventListener(EVENEMENT, compter);
    };
  }, []);

  if (enLigne && !attente) return null;
  return (
    <span className={`statut-reseau${enLigne ? '' : ' statut-hors-ligne'}`} role="status">
      {enLigne ? 'En ligne' : 'Hors ligne'}{attente > 0 && ` · ${attente} à envoyer`}
    </span>
  );
}
