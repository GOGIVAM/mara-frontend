import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import Scene3D from '../components/Scene3D.jsx';

const MODES = [
  { id: 'plan', libelle: 'Plan 2D' },
  { id: '3d', libelle: 'Maquette 3D' },
  { id: 'ra', libelle: 'Réalité augmentée' },
];

const AUCUN_MODELE = "Aucun modèle chargé. Les plans de l'essieu T17 sont attendus.";

/** Consultation de l'essieu en plan 2D, en 3D et en réalité augmentée. */
export default function Modele() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') || 'plan');
  const [erreur, setErreur] = useState('');
  const video = useRef(null);

  useEffect(() => {
    if (mode !== 'ra') return undefined;
    let flux;
    let annule = false;
    setErreur('');
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((f) => {
        if (annule) { f.getTracks().forEach((t) => t.stop()); return; }
        flux = f;
        if (video.current) video.current.srcObject = f;
      })
      .catch(() => setErreur('Autorisez la caméra pour utiliser la réalité augmentée.'));
    return () => { annule = true; flux?.getTracks().forEach((t) => t.stop()); };
  }, [mode]);

  return (
    <div className="page modele">
      <header className="modele-tete">
        <h2>Essieu T17</h2>
        <div className="modes" role="tablist" aria-label="Mode d'affichage">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id}
              className={`mode${mode === m.id ? ' mode-actif' : ''}`} onClick={() => setMode(m.id)}>
              {mode === m.id && <motion.span layoutId="mode-actif" className="mode-fond"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span>{m.libelle}</span>
            </button>
          ))}
        </div>
      </header>

      <section className="card modele-vue">
        <div className={`scene-zone${mode === 'ra' ? ' scene-zone-ra' : ''}`}>
          {mode === 'ra' && <video ref={video} autoPlay playsInline muted />}
          {mode !== 'plan' && <Scene3D transparent={mode === 'ra'} />}
          <p className="modele-vide">{AUCUN_MODELE}</p>
        </div>
      </section>
      {erreur && <p className="scan-error" role="alert">{erreur}</p>}
    </div>
  );
}
