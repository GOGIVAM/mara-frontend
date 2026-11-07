import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';

const TRAINS = {
  scene: { gif: '/gifs/train-scene.gif', fixe: '/gifs/train-scene.jpg', largeur: 800, hauteur: 800 },
  petit: { gif: '/gifs/train-petit.gif', fixe: '/gifs/train-petit.jpg', largeur: 160, hauteur: 116 },
};

/** Prise de vue d'un train, en image fixe si l'utilisateur refuse les animations. */
export function TrainGif({ variante = 'petit', className, alt = '' }) {
  const reduit = useReducedMotion();
  const train = TRAINS[variante];
  return (
    <img src={reduit ? train.fixe : train.gif} width={train.largeur} height={train.hauteur}
      className={className} alt={alt} />
  );
}

/** Train qui avance le long de la barre, avec un repère par étape. */
export function RailProgression({ faites, total, sens = 1 }) {
  const reduit = useReducedMotion();
  const position = (n) => (total ? (n / total) * 100 : 0);
  const depart = Math.min(total, Math.max(0, faites - sens));
  return (
    <div className="rail" role="progressbar" aria-label="Avancement de la visite"
      aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites}>
      <div className="rail-roue-zone">
        <motion.div className="rail-roue"
          initial={reduit ? false : { left: `${position(depart)}%` }}
          animate={{ left: `${position(faites)}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 16 }}>
          <TrainGif />
        </motion.div>
      </div>
      <div className="rail-voie">
        <motion.span className="rail-fait"
          initial={reduit ? false : { width: `${position(depart)}%` }}
          animate={{ width: `${position(faites)}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }} />
        {Array.from({ length: total + 1 }, (_, i) => (
          <i key={i} style={{ left: `${position(i)}%` }} className={i <= faites ? 'rail-passe' : ''} />
        ))}
      </div>
    </div>
  );
}

/** Nombre qui monte jusqu'à sa valeur. Sans valeur, affiche un bloc de chargement. */
export function Compteur({ valeur, suffixe = '' }) {
  const noeud = useRef(null);
  const reduit = useReducedMotion();
  const precedent = useRef(0);

  useEffect(() => {
    if (typeof valeur !== 'number' || !noeud.current) return undefined;
    if (reduit) {
      noeud.current.textContent = `${valeur}${suffixe}`;
      precedent.current = valeur;
      return undefined;
    }
    const controle = animate(precedent.current, valeur, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { if (noeud.current) noeud.current.textContent = `${Math.round(v)}${suffixe}`; },
    });
    precedent.current = valeur;
    return () => controle.stop();
  }, [valeur, suffixe, reduit]);

  if (typeof valeur !== 'number') return <span className="squelette" aria-label="Chargement" />;
  return <span ref={noeud}>0{suffixe}</span>;
}

export const CONTENEUR = {
  cache: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const ELEMENT = {
  cache: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

/** Coche qui se dessine, pour une étape qui vient d'être validée. */
export function Coche({ animee }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className="coche" aria-hidden="true">
      <motion.path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        initial={animee ? { pathLength: 0 } : false} animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }} />
    </svg>
  );
}

/** Champ de fichier en français, sans le bouton natif du navigateur. */
export function ChampFichier({ id, libelle, inputRef, onChange, required, accept, capture }) {
  const [nom, setNom] = useState('');
  return (
    <div className="champ-fichier">
      <input id={id} ref={inputRef} type="file" className="visuellement-cache" required={required}
        accept={accept} capture={capture}
        onChange={(e) => { setNom(e.target.files?.[0]?.name || ''); onChange?.(e); }} />
      <label htmlFor={id} className="chip">{libelle}</label>
      <span className="muted">{nom || 'Aucun fichier choisi'}</span>
    </div>
  );
}
