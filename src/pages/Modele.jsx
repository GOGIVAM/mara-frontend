import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import PlanAxe from '../components/PlanAxe.jsx';
import Scene3D from '../components/Scene3D.jsx';

const MODES = [
  { id: 'plan', libelle: 'Plan 2D' },
  { id: '3d', libelle: 'Maquette 3D' },
  { id: 'ra', libelle: 'Réalité augmentée' },
];

const MODELE = '/modeles/axe-voie-metrique.glb';
const META = '/modeles/axe-voie-metrique.json';

/** Consultation de l'axe en plan 2D, en 3D et en réalité augmentée. */
export default function Modele() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') || 'plan');
  const [meta, setMeta] = useState(null);
  const [organe, setOrgane] = useState(null);
  const [erreur, setErreur] = useState('');
  const [place, setPlace] = useState({ echelle: 1, x: 0, y: 0 });
  const [deplace, setDeplace] = useState(false);
  const video = useRef(null);
  const scene = useRef(null);

  const choisir = (o) => setOrgane((actuel) => (actuel === o ? null : o));
  const fiche = organe && meta?.organes[organe];

  useEffect(() => {
    fetch(META).then((r) => (r.ok ? r.json() : Promise.reject())).then(setMeta)
      .catch(() => setErreur("Le modèle de l'axe n'a pas pu être chargé."));
  }, []);

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

  useEffect(() => {
    scene.current?.placer(mode === 'ra' ? { ...place, face: true } : { echelle: 1, x: 0, y: 0, face: false });
  }, [mode, place]);

  const reglage = (cle, v) => setPlace((p) => ({ ...p, [cle]: v }));

  return (
    <div className="page modele">
      <header className="modele-tete">
        <div>
          <h2>{meta?.titre || 'Essieu'}</h2>
          {meta && <p className="muted">{meta.avertissement}</p>}
        </div>
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

      <div className="modele-grille">
        <section className="card modele-vue">
          {mode === 'plan'
            ? (meta ? <PlanAxe meta={meta} organe={organe} choisir={choisir} /> : <p className="modele-vide">Chargement du plan…</p>)
            : (
              <div className={`scene-zone${mode === 'ra' ? ' scene-zone-ra' : ''}`}>
                {mode === 'ra' && <video ref={video} autoPlay playsInline muted />}
                <Scene3D ref={scene} modele={MODELE} organe={organe} transparent={mode === 'ra'}
                  onSelection={setOrgane} onDeplace={setDeplace}
                  onCharge={(ok) => !ok && setErreur("La maquette n'a pas pu être chargée.")} />
              </div>
            )}
        </section>

        <aside className="card panel modele-outils">
          <h3>Organes</h3>
          <ul className="organes">
            {meta && Object.entries(meta.organes).map(([id, o]) => (
              <li key={id}>
                <button className={`organe${organe === id ? ' organe-actif' : ''}`} aria-pressed={organe === id}
                  onClick={() => choisir(id)}>{o.nom}</button>
              </li>
            ))}
          </ul>
          <AnimatePresence mode="wait">
            {fiche && (
              <motion.p key={organe} className="organe-fiche" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {fiche.description}
              </motion.p>
            )}
          </AnimatePresence>

          {meta && (
            <>
              <h3>Cotes du plan</h3>
              <dl className="cotes">
                {meta.cotes.map((c) => (
                  <div key={c.libelle}><dt>{c.libelle}</dt><dd>{c.valeur}</dd></div>
                ))}
              </dl>
              <p className="muted modele-source">
                <a href={meta.url} target="_blank" rel="noreferrer">{meta.source}</a>. Roues et boîtes d'essieu à ajouter d'après leurs plans.
              </p>
            </>
          )}

          {mode !== 'plan' && (
            <div className="pieces-deplacement">
              <p className="muted">Faites glisser une pièce pour la déplacer ; un appui court la sélectionne.</p>
              <button className="chip" disabled={!deplace} onClick={() => scene.current?.remettreEnPlace()}>
                Remettre les pièces en place
              </button>
            </div>
          )}

          {mode === 'ra' && (
            <div className="reglages-ra">
              <h3>Caler sur l'essieu</h3>
              <label htmlFor="ra-echelle">Taille</label>
              <input id="ra-echelle" type="range" min="0.25" max="2" step="0.01" value={place.echelle}
                onChange={(e) => reglage('echelle', Number(e.target.value))} />
              <label htmlFor="ra-x">Gauche ou droite</label>
              <input id="ra-x" type="range" min="-1.5" max="1.5" step="0.01" value={place.x}
                onChange={(e) => reglage('x', Number(e.target.value))} />
              <label htmlFor="ra-y">Haut ou bas</label>
              <input id="ra-y" type="range" min="-1" max="1" step="0.01" value={place.y}
                onChange={(e) => reglage('y', Number(e.target.value))} />
            </div>
          )}
          {erreur && <p className="scan-error" role="alert">{erreur}</p>}
        </aside>
      </div>
    </div>
  );
}
