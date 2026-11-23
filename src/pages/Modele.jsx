import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import PlanAxe from '../components/PlanAxe.jsx';
import Scene3D from '../components/Scene3D.jsx';
import { classLabel } from '../lib/format.js';
import { equipementDuMarqueur, lireMarqueur } from '../lib/marqueur.js';
import { signal as jouerSignal } from '../lib/son.js';
import { useCommandesVocales } from '../lib/voix.js';
import {
  STATUTS, STATUTS_COTE, capacitesTerminal, chargerCatalogue, chargerMaquette, etatHorsLigne, lireRef,
  nomenclature, preparerHorsLigne, resoudre,
} from '../lib/maquettes.js';
import {
  actionsPossibles, appliquer, controlerManifeste, estDemontage, etapeCourante, etapeFaite, etatInitial, executerEtape,
  indexer, phaseApres, toutEnPlace,
} from '../lib/scenario.js';

const MODES = [
  { id: 'plan', libelle: 'Plan 2D' },
  { id: '3d', libelle: 'Atelier 3D' },
  { id: 'camera', libelle: 'Caméra' },
  { id: 'xr', libelle: 'RA suivie' },
];
const VUES = [
  ['face', 'Face'], ['arriere', 'Arrière'], ['gauche', 'Gauche'], ['droite', 'Droite'],
  ['dessus', 'Dessus'], ['dessous', 'Dessous'], ['trois_quarts', '3/4'],
];
const ONGLETS = [
  ['pieces', 'Pièces'], ['demontage', 'Démontage'], ['reglages', 'Réglages'], ['sources', 'Sources'], ['hors_ligne', 'Hors ligne'],
];
const ETAT_LIBELLE = { monte: 'En place', devisse: 'Dévissée', depose: 'Déposée' };
const CALAGE = { echelle: 1, x: 0, y: 0, rotation: 0 };
const lireGamme = (id) => { try { return JSON.parse(localStorage.getItem(`mara.gamme.${id}`)); } catch { return null; } };
const garderGamme = (g) => { try { localStorage.setItem(`mara.gamme.${g.id}`, JSON.stringify(g)); } catch { /* plein */ } };
const mmTexte = (v) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mm`;

/** Plan 2D, atelier 3D, caméra et RA suivie d'une maquette du catalogue. */
export default function Modele() {
  const [params, setParams] = useSearchParams();
  const [catalogue, setCatalogue] = useState(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [maquette, setMaquette] = useState(null);       // { entree, manifeste, glb, integrite }
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState(params.get('mode') || 'plan');
  const [onglet, setOnglet] = useState('pieces');
  const [selection, setSelection] = useState(params.get('piece'));
  const [etat, setEtat] = useState({});
  const [historique, setHistorique] = useState([]);
  const [phase, setPhase] = useState('demontage');
  const [eclate, setEclate] = useState(0);
  const [coupe, setCoupe] = useState({ actif: false, position: 0.5 });
  const [articulations, setArticulations] = useState({});
  const [isoles, setIsoles] = useState([]);
  const [masques, setMasques] = useState([]);
  const [fond, setFond] = useState('atelier');
  const [projection, setProjection] = useState('perspective');
  const [manipulation, setManipulation] = useState('vue');
  const [reperesSeuls, setReperesSeuls] = useState(false);
  const [opacite, setOpacite] = useState(0.85);
  const [calage, setCalage] = useState(CALAGE);
  const [etatSignal, setEtatSignal] = useState('eteint');
  const [ecart, setEcart] = useState(0);
  const [manipule, setManipule] = useState(false);
  const [planCote, setPlanCote] = useState(true);
  const [gamme, setGamme] = useState(null);
  const [capacites, setCapacites] = useState(null);
  const [xr, setXr] = useState(null);                  // { suivi, place }
  const [chargee, setChargee] = useState(false);
  const [surMarqueur, setSurMarqueur] = useState(false);
  const [ancre, setAncre] = useState(null);           // position du marqueur dans la vue
  const [marqueurLu, setMarqueurLu] = useState(null); // { texte }
  const [equipements, setEquipements] = useState([]);
  const scene = useRef(null);
  const video = useRef(null);
  const vue = useRef(null);
  const overlayXr = useRef(null);

  const actifDemande = params.get('actif');
  const codeDemande = params.get('code');
  const classeDemandee = params.get('classe');
  const gammeId = params.get('gamme');
  const etapeId = params.get('etape');
  const retour = params.get('retour');

  const majParams = useCallback((maj) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      Object.entries(maj).forEach(([k, v]) => (v === null || v === undefined || v === '' ? n.delete(k) : n.set(k, v)));
      return n;
    }, { replace: true });
  }, [setParams]);

  // ── Catalogue ──────────────────────────────────────────────────────────────
  useEffect(() => {
    chargerCatalogue()
      .then(({ catalogue: c, horsLigne: h }) => { setCatalogue(c); setHorsLigne(h); })
      .catch((e) => setErreur(e.message));
  }, []);

  const entree = useMemo(
    () => (catalogue ? resoudre(catalogue, { actif: actifDemande, code: codeDemande, classe: classeDemandee })
      || resoudre(catalogue, { actif: 'axe-eg6' }) : null),
    [catalogue, actifDemande, codeDemande, classeDemandee],
  );

  // ── Maquette ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!entree) return undefined;
    let annule = false;
    setChargee(false);
    setMaquette(null);
    setErreur('');
    chargerMaquette(entree)
      .then((m) => {
        if (annule) return;
        const erreurs = controlerManifeste(m.manifeste);
        if (erreurs.length) throw new Error(`Manifeste refusé : ${erreurs.join(' ; ')}`);
        setMaquette({ entree, ...m });
        setEtat(etatInitial(m.manifeste));
        setHistorique([]);
        setPhase('demontage');
        setArticulations({});
        setEclate(0);
        setCoupe({ actif: false, position: 0.5 });
        setIsoles([]);
        setMasques([]);
        setManipule(false);
        setEtatSignal('eteint');
        setPlanCote(Boolean(m.manifeste.planCote));
      })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
  }, [entree]);

  const manifeste = maquette?.manifeste;
  const idx = useMemo(() => (manifeste ? indexer(manifeste) : null), [manifeste]);
  const liste = useMemo(() => nomenclature(manifeste), [manifeste]);

  // Vue demandée par une étape : éclaté, coupe ou vue rapide.
  const vueDemandee = params.get('vue');
  useEffect(() => {
    if (!chargee || !vueDemandee) return;
    if (vueDemandee === 'eclate') setEclate(1);
    else if (vueDemandee === 'coupe') setCoupe((c) => ({ ...c, actif: true }));
    else scene.current?.vue(vueDemandee);
  }, [chargee, vueDemandee]);

  // ── Gamme et étape ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gammeId) { setGamme(null); return; }
    api.gamme(gammeId).then((g) => { garderGamme(g); setGamme(g); })
      .catch(() => setGamme(lireGamme(gammeId)));
  }, [gammeId]);
  const etapes = useMemo(() => [...(gamme?.etapes || [])].sort((a, b) => a.ordreIndex - b.ordreIndex), [gamme]);
  const indexEtape = etapes.findIndex((e) => e.id === etapeId);
  const etapeGamme = indexEtape >= 0 ? etapes[indexEtape] : null;

  const allerEtape = (i) => {
    const e = etapes[i];
    if (!e) return;
    const r = lireRef(e.arContentRef);
    setSelection(r?.piece || null);
    majParams({ etape: e.id, actif: r?.actif || params.get('actif'), piece: r?.piece, vue: r?.vue, code: null, classe: null });
  };

  // ── Sélection conservée dans l'adresse ─────────────────────────────────────
  const choisir = useCallback((id) => {
    setSelection((actuel) => {
      const nouveau = actuel === id ? null : id;
      majParams({ piece: nouveau });
      return nouveau;
    });
  }, [majParams]);

  const changerMode = (m) => { setMode(m); majParams({ mode: m }); setMessage(''); };

  // ── Caméra réelle ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera') return undefined;
    let flux;
    let annule = false;
    const refus = (texte) => {
      setMode('3d');
      majParams({ mode: '3d' });
      setMessage(texte);
    };
    if (!navigator.mediaDevices?.getUserMedia) {
      refus("Caméra indisponible sur ce terminal ou hors HTTPS. Retour à l'atelier 3D : la pièce et l'étape sont conservées.");
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((f) => {
        if (annule) { f.getTracks().forEach((t) => t.stop()); return; }
        flux = f;
        if (video.current) video.current.srcObject = f;
      })
      .catch(() => refus("Accès à la caméra refusé ou impossible. Retour à l'atelier 3D : la pièce et l'étape sont conservées."));
    return () => { annule = true; flux?.getTracks().forEach((t) => t.stop()); };
  }, [mode, majParams]);

  // ── Calage sur le marqueur QR (mode Caméra) ────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera' || !surMarqueur) { setAncre(null); return undefined; }
    api.equipements().then(setEquipements).catch(() => {});
    let actif = true;
    let vu = 0;
    const boucle = async () => {
      while (actif) {
        const v = video.current;
        const lu = await lireMarqueur(v).catch(() => null);
        if (!actif) break;
        if (lu && v) {
          vu = performance.now();
          // Passage des coordonnées de l'image à celles de l'écran (vidéo affichée en « cover »).
          const l = v.clientWidth;
          const h = v.clientHeight;
          const e = Math.max(l / v.videoWidth, h / v.videoHeight);
          const dl = v.videoWidth * e;
          const dh = v.videoHeight * e;
          setAncre({ x: (l - dl) / 2 + lu.cx * dl, y: (h - dh) / 2 + lu.cy * dh, taille: lu.taille * dh, angle: lu.angle, perdu: false });
          setMarqueurLu((m) => (m?.texte === lu.texte ? m : { texte: lu.texte }));
        } else if (vu && performance.now() - vu > 1000) {
          setAncre((a) => (a && !a.perdu ? { ...a, perdu: true } : a));
        }
        await new Promise((res) => setTimeout(res, 120));
      }
    };
    boucle();
    return () => { actif = false; };
  }, [mode, surMarqueur]);
  const equipementLu = marqueurLu && equipementDuMarqueur(equipements, marqueurLu.texte);
  const autreMaquette = equipementLu && catalogue && resoudre(catalogue, { code: equipementLu.code, classe: equipementLu.classe });

  // ── RA suivie : capacités du terminal ──────────────────────────────────────
  useEffect(() => {
    if (mode === 'xr' && !capacites) capacitesTerminal().then(setCapacites);
  }, [mode, capacites]);

  const lancerXR = async () => {
    setMessage('');
    try {
      await scene.current.lancerXR({
        overlay: overlayXr.current,
        echelle: 0.3,
        onSuivi: (suivi, place) => setXr((x) => ({ ...x, suivi, place: place ?? x?.place })),
        onFin: () => { setXr(null); },
      });
      setXr({ suivi: 'recherche', place: false });
    } catch (e) {
      setXr(null);
      setMode('3d');
      majParams({ mode: '3d' });
      setMessage(`Session de RA suivie impossible (${e.message || e.name}). Retour à l'atelier 3D.`);
    }
  };

  // ── Démontage ──────────────────────────────────────────────────────────────
  const agir = (action, id) => {
    const r = appliquer(idx, etat, action, id);
    if (!r.ok) { setMessage(r.raison); jouerSignal('vigilance'); return false; }
    jouerSignal(action === 'reposer' || action === 'visser' ? 'validation' : 'clic');
    setHistorique((h) => [...h, etat]);
    setEtat(r.etat);
    setPhase((p) => phaseApres(manifeste.scenario, r.etat, p));
    setMessage('');
    return true;
  };
  const executer = (etape) => {
    const r = executerEtape(idx, etat, etape);
    if (!r.ok) { setMessage(r.raison); jouerSignal('vigilance'); return; }
    jouerSignal(etape.action === 'reposer' || etape.action === 'visser' ? 'validation' : 'clic');
    setHistorique((h) => [...h, etat]);
    setEtat(r.etat);
    setPhase((p) => phaseApres(manifeste.scenario, r.etat, p));
    setSelection(etape.pieces[0]);
    setMessage('');
  };
  const annuler = () => {
    if (!historique.length) return;
    const precedent = historique.at(-1);
    setHistorique((h) => h.slice(0, -1));
    setEtat(precedent);
    if (toutEnPlace(precedent)) setPhase('demontage');
  };
  const reinitialiser = () => {
    setEtat(etatInitial(manifeste));
    setHistorique([]);
    setPhase('demontage');
    setEclate(0);
    setArticulations({});
    setManipule(false);
    scene.current?.reinitialiser();
  };
  const etatCourant = useRef(etat);
  etatCourant.current = etat;
  const aimanter = useCallback((id) => {
    const e = etatCourant.current;
    const r = appliquer(idx, e, 'reposer', id);
    if (!r.ok) { setMessage(r.raison); jouerSignal('vigilance'); return; }
    setHistorique((h) => [...h, e]);
    setEtat(r.etat);
    jouerSignal('validation');
    setMessage(`${idx.pieces.get(id)?.nom} remise en place.`);
  }, [idx]);

  const surCharge = useCallback((r) => {
    if (!r.ok) { setErreur(`La maquette n'a pas pu être affichée : ${r.erreur}`); return; }
    const absents = maquette?.manifeste.pieces.filter((p) => !r.noeuds.has(p.noeud)) || [];
    if (absents.length) setErreur(`Nœuds absents du GLB : ${absents.map((p) => p.noeud).join(', ')}`);
    setChargee(true);
  }, [maquette]);

  const scenarioCourant = manifeste?.scenario ? etapeCourante(manifeste.scenario, etat, phase) : -1;
  const vocal = useCommandesVocales({
    suivante: ['étape suivante', 'suivante', 'suivant'],
    annuler: ['annuler', 'retour arrière'],
    plan: ['plan', 'plan deux d'],
    trois_d: ['trois d', '3d', 'atelier'],
    camera: ['caméra', 'camera'],
    face: ['vue de face', 'face'],
    eclate: ['éclaté', 'eclate', 'vue éclatée'],
    recentrer: ['recentrer', 'centrer'],
  }, (cle) => {
    if (cle === 'suivante' && scenarioCourant >= 0) executer(manifeste.scenario.etapes[scenarioCourant]);
    else if (cle === 'annuler') annuler();
    else if (cle === 'plan') changerMode('plan');
    else if (cle === 'trois_d') changerMode('3d');
    else if (cle === 'camera') changerMode('camera');
    else if (cle === 'face') scene.current?.vue('face');
    else if (cle === 'eclate') setEclate((v) => (v > 0 ? 0 : 1));
    else if (cle === 'recentrer') scene.current?.recentrer();
  });

  if (erreur && !maquette) {
    return <div className="page"><p className="scan-error" role="alert">{erreur}</p></div>;
  }

  const statut = STATUTS[manifeste?.statut];
  const signal = manifeste?.etats?.find((e) => e.id === etatSignal);
  const scenarioIndex = scenarioCourant;
  const enPlace = toutEnPlace(etat);
  const pieceChoisie = selection && (idx?.pieces.get(selection)
    || manifeste?.pieces.find((p) => p.organe === selection));
  const groupeChoisi = liste.find((g) => g.organe === selection || g.pieces.includes(selection));
  const afficherPlanCote = mode === 'plan' && planCote && manifeste?.planCote;

  return (
    <div className="page modele">
      {etapeGamme && (
        <div className="etape-gamme" role="region" aria-label="Étape de gamme">
          <span className="muted">{gamme.code} · étape {etapeGamme.ordreIndex} sur {etapes.length}</span>
          <strong>{etapeGamme.description}</strong>
          <span className="etape-gamme-actions">
            <button className="chip" disabled={indexEtape <= 0} onClick={() => allerEtape(indexEtape - 1)}>Étape précédente</button>
            <button className="chip" disabled={indexEtape >= etapes.length - 1} onClick={() => allerEtape(indexEtape + 1)}>Étape suivante</button>
            {retour === 'intervention' && <Link className="chip" to="/intervention">Revenir à l'intervention</Link>}
            {retour === 'gammes' && <Link className="chip" to="/gammes">Revenir aux gammes</Link>}
          </span>
        </div>
      )}

      <header className="modele-tete">
        <div>
          <h2>{manifeste?.titre || 'Maquette'}</h2>
          {manifeste && (
            <p className="muted">
              <span className={`badge ${statut?.classe || ''}`}>{statut?.libelle}</span>{' '}
              {manifeste.variante} · version {manifeste.version}
              {horsLigne && <span className="badge-demo">Hors ligne</span>}
            </p>
          )}
          {manifeste && <p className="modele-avertissement">{manifeste.avertissement}</p>}
        </div>
        <div className="modele-choix">
          <label htmlFor="choix-actif" className="sr-only">Maquette</label>
          <select id="choix-actif" className="filter-select" value={entree?.actif || ''}
            onChange={(e) => { setSelection(null); majParams({ actif: e.target.value, code: null, classe: null, piece: null, vue: null }); }}>
            {catalogue?.actifs.map((a) => (
              <option key={a.actif} value={a.actif}>{classLabel(a.classe)} · {a.titre}</option>
            ))}
          </select>
          <div className="modes" role="tablist" aria-label="Mode d'affichage">
            {MODES.map((m) => (
              <button key={m.id} role="tab" aria-selected={mode === m.id}
                className={`mode${mode === m.id ? ' mode-actif' : ''}`} onClick={() => changerMode(m.id)}>
                {mode === m.id && <motion.span layoutId="mode-actif" className="mode-fond"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span>{m.libelle}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="modele-grille">
        <section className="card modele-vue" ref={vue}>
          {afficherPlanCote ? (
            <div className="plan-cote">
              <PlanAxe meta={{ ...manifeste.planCote, organes: Object.fromEntries(Object.entries(manifeste.organes || {}).map(([k, n]) => [k, { nom: n }])) }}
                organe={pieceChoisie?.organe || selection} choisir={choisir} />
              <button className="chip plan-bascule" onClick={() => setPlanCote(false)}>Vues de la maquette</button>
            </div>
          ) : (
            <div className={`scene-zone${mode === 'camera' ? ' scene-zone-ra' : ''}${mode === 'plan' ? ' scene-zone-plan' : ''}`}>
              {mode === 'camera' && <video ref={video} autoPlay playsInline muted />}
              {maquette && (
                <Scene3D ref={scene} glb={maquette.glb} manifeste={manifeste} affichage={mode === 'xr' ? '3d' : mode}
                  selection={selection} etat={etat} eclate={eclate} coupe={coupe} articulations={articulations}
                  isoles={isoles} masques={masques} fond={fond} projection={projection} manipulation={manipulation}
                  reperesSeuls={reperesSeuls} opacite={opacite} calage={calage} ancre={mode === 'camera' ? ancre : null}
                  etatSignal={signal ? { allumes: signal.allumes, couleur: signal.couleur } : null}
                  onSelection={choisir} onCharge={surCharge} onEcart={setEcart} onAimanter={aimanter} onManipule={setManipule} />
              )}
              {!chargee && <p className="modele-vide">Chargement de la maquette…</p>}
              {mode === 'camera' && (
                <p className="bandeau-approx" role="note">
                  {surMarqueur
                    ? (ancre ? (ancre.perdu ? 'Marqueur perdu : position figée, repères masqués.' : 'Calée sur le marqueur QR : superposition approximative en 2D, sans profondeur. Ne pas l’utiliser pour viser un repère de précision.')
                      : 'Recherche du marqueur QR…')
                    : 'Superposition approximative : calage manuel, sans mesure ni suivi. Ne pas l’utiliser pour viser un repère de précision.'}
                </p>
              )}
              {mode !== 'xr' && chargee && (
                <BarreOutils scene={scene} vue={vue} mode={mode} projection={projection} setProjection={setProjection}
                  fond={fond} setFond={setFond} manipulation={manipulation} setManipulation={setManipulation}
                  planCoteDisponible={Boolean(manifeste?.planCote)} setPlanCote={setPlanCote} />
              )}
              {mode === 'xr' && (
                <div ref={overlayXr} className="xr-overlay">
                  <RaSuivie capacites={capacites} xr={xr} lancer={lancerXR} scene={scene} />
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="card panel modele-outils">
          <div className="onglets" role="tablist" aria-label="Panneaux">
            {ONGLETS.filter(([id]) => id !== 'demontage' || manifeste?.scenario).map(([id, libelle]) => (
              <button key={id} role="tab" aria-selected={onglet === id} className={`onglet${onglet === id ? ' onglet-actif' : ''}`}
                onClick={() => setOnglet(id)}>{libelle}</button>
            ))}
          </div>

          {message && <p className="modele-message" role="status">{message}</p>}
          {erreur && <p className="scan-error" role="alert">{erreur}</p>}

          {onglet === 'pieces' && manifeste && (
            <PanneauPieces liste={liste} selection={selection} choisir={choisir} groupe={groupeChoisi} piece={pieceChoisie}
              manifeste={manifeste} isoles={isoles} setIsoles={setIsoles} masques={masques} setMasques={setMasques}
              etat={etat} idx={idx} agir={agir} />
          )}
          {onglet === 'demontage' && manifeste?.scenario && (
            <PanneauDemontage manifeste={manifeste} etat={etat} phase={phase} courant={scenarioIndex} executer={executer}
              annuler={annuler} reinitialiser={reinitialiser} historique={historique} enPlace={enPlace} ecart={ecart}
              selection={pieceChoisie} idx={idx} agir={agir} manipulation={manipulation} setManipulation={setManipulation} />
          )}
          {onglet === 'reglages' && manifeste && (
            <PanneauReglages manifeste={manifeste} mode={mode} eclate={eclate} setEclate={setEclate} coupe={coupe} setCoupe={setCoupe}
              articulations={articulations} setArticulations={setArticulations} etatSignal={etatSignal} setEtatSignal={setEtatSignal}
              calage={calage} setCalage={setCalage} opacite={opacite} setOpacite={setOpacite} reperesSeuls={reperesSeuls}
              setReperesSeuls={setReperesSeuls} manipule={manipule} remettre={() => { scene.current?.remettreEnPlace(); setManipule(false); }}
              surMarqueur={surMarqueur} setSurMarqueur={setSurMarqueur} marqueurLu={marqueurLu} equipementLu={equipementLu}
              autreMaquette={autreMaquette && autreMaquette.actif !== entree?.actif ? autreMaquette : null}
              ouvrir={(a) => { setSelection(null); majParams({ actif: a.actif, code: equipementLu?.code, classe: null, piece: null, vue: null }); }}
              vocal={vocal} />
          )}
          {onglet === 'sources' && manifeste && <PanneauSources manifeste={manifeste} integrite={maquette.integrite} />}
          {onglet === 'hors_ligne' && catalogue && <PanneauHorsLigne catalogue={catalogue} horsLigne={horsLigne} />}
        </aside>
      </div>
    </div>
  );
}

function BarreOutils({ scene, vue, mode, projection, setProjection, fond, setFond, manipulation, setManipulation, planCoteDisponible, setPlanCote }) {
  const pleinEcran = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else vue.current?.requestFullscreen?.().catch(() => {});
  };
  return (
    <div className="barre-outils" role="toolbar" aria-label="Commandes de la vue">
      <div className="barre-groupe">
        {VUES.map(([id, libelle]) => (
          <button key={id} className="outil" onClick={() => scene.current?.vue(id)} title={`Vue ${libelle}`}>{libelle}</button>
        ))}
      </div>
      <div className="barre-groupe">
        <button className="outil" onClick={() => scene.current?.zoomer(1.25)} aria-label="Zoom avant">+</button>
        <button className="outil" onClick={() => scene.current?.zoomer(0.8)} aria-label="Zoom arrière">−</button>
        <button className="outil" onClick={() => scene.current?.tourner(-0.3, 0)} aria-label="Tourner à gauche">⟲</button>
        <button className="outil" onClick={() => scene.current?.tourner(0.3, 0)} aria-label="Tourner à droite">⟳</button>
        <button className="outil" onClick={() => scene.current?.recentrer()}>Recentrer</button>
        <button className="outil" onClick={pleinEcran}>Plein écran</button>
        {mode === '3d' && (
          <>
            <button className="outil" aria-pressed={projection === 'orthographique'}
              onClick={() => setProjection(projection === 'perspective' ? 'orthographique' : 'perspective')}>
              {projection === 'perspective' ? 'Perspective' : 'Orthographique'}
            </button>
            <button className="outil" aria-pressed={fond === 'atelier'} onClick={() => setFond(fond === 'atelier' ? 'neutre' : 'atelier')}>
              {fond === 'atelier' ? 'Fond atelier' : 'Fond neutre'}
            </button>
          </>
        )}
        {mode === 'plan' && planCoteDisponible && <button className="outil" onClick={() => setPlanCote(true)}>Plan coté</button>}
      </div>
      {mode !== 'plan' && (
        <div className="barre-groupe" role="radiogroup" aria-label="Manipulation">
          {[['vue', 'Tourner la vue'], ['objet', "Déplacer l'objet"], ['piece', 'Déplacer une pièce']].map(([id, libelle]) => (
            <button key={id} role="radio" aria-checked={manipulation === id} className={`outil${manipulation === id ? ' outil-actif' : ''}`}
              onClick={() => setManipulation(id)}>{libelle}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function PanneauPieces({ liste, selection, choisir, groupe, piece, manifeste, isoles, setIsoles, masques, setMasques, etat, idx, agir }) {
  const source = piece && manifeste.sources.find((s) => s.id === piece.source);
  const cle = groupe?.organe;
  const basculer = (tab, set) => set(tab.includes(cle) ? tab.filter((x) => x !== cle) : [...tab, cle]);
  return (
    <>
      <ol className="nomenclature">
        {liste.map((g) => (
          <li key={g.organe}>
            <button className={`organe${groupe?.organe === g.organe ? ' organe-actif' : ''}${masques.includes(g.organe) ? ' organe-masque' : ''}`}
              aria-pressed={groupe?.organe === g.organe} onClick={() => choisir(g.organe)}>
              <span className="repere-num">{g.numero}</span> {g.nom}
              {g.pieces.length > 1 && <span className="muted"> ×{g.pieces.length}</span>}
            </button>
          </li>
        ))}
      </ol>
      {groupe && (
        <div className="fiche-piece">
          <div className="fiche-actions">
            <button className="chip" aria-pressed={isoles.includes(cle)} onClick={() => basculer(isoles, setIsoles)}>
              {isoles.includes(cle) ? 'Tout afficher' : 'Isoler'}
            </button>
            <button className="chip" aria-pressed={masques.includes(cle)} onClick={() => basculer(masques, setMasques)}>
              {masques.includes(cle) ? 'Afficher' : 'Masquer'}
            </button>
          </div>
          {groupe.pieces.length > 1 && (
            <select className="filter-select" value={idx.pieces.has(selection) ? selection : ''} onChange={(e) => choisir(e.target.value || groupe.organe)}>
              <option value="">Toutes ({groupe.pieces.length})</option>
              {groupe.pieces.map((id) => <option key={id} value={id}>{idx.pieces.get(id).nom}</option>)}
            </select>
          )}
          {piece && (
            <dl className="cotes">
              {piece.repere && <div><dt>Repère source</dt><dd>{piece.repere}</dd></div>}
              {piece.reference && <div><dt>Référence</dt><dd>{piece.reference}</dd></div>}
              <div><dt>État</dt><dd>{ETAT_LIBELLE[etat[piece.id]] || 'En place'}</dd></div>
            </dl>
          )}
          {piece?.description && <p className="organe-fiche">{piece.description}</p>}
          {piece?.simplification && <p className="organe-fiche"><strong>Simplification :</strong> {piece.simplification}</p>}
          {source && (
            <p className="modele-source">
              Source : <a href={source.url} target="_blank" rel="noreferrer">{source.editeur}, {source.titre}</a>, {piece.page || source.page}
            </p>
          )}
          {piece && idx.pieces.has(piece.id) && manifeste.scenario && (
            <div className="fiche-actions">
              {actionsPossibles(idx, etat, piece.id).filter((a) => a.ok).map((a) => (
                <button key={a.action} className="chip" onClick={() => agir(a.action, piece.id)}>
                  {a.libelle[0].toUpperCase() + a.libelle.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function PanneauDemontage({ manifeste, etat, phase, courant, executer, annuler, reinitialiser, historique, enPlace, ecart, selection, idx, agir, manipulation, setManipulation }) {
  const { scenario } = manifeste;
  const etape = courant >= 0 ? scenario.etapes[courant] : null;
  const termine = courant < 0 && phase === 'remontage';
  return (
    <div className="demontage">
      <h3>{scenario.titre}</h3>
      <p className="demo-banner demontage-avertissement">{scenario.avertissement}</p>
      <p className="muted">Phase : {phase === 'demontage' ? 'démontage' : 'remontage'}</p>
      <ol className="scenario">
        {scenario.etapes.map((e, i) => (
          <li key={e.id} className={`scenario-${i === courant ? 'courante' : (estDemontage(e) ? phase === 'remontage' || etapeFaite(e, etat) : phase === 'remontage' && etapeFaite(e, etat)) ? 'faite' : 'attente'}`}>
            {e.texte}
          </li>
        ))}
      </ol>
      {etape && (
        <button className="primary-btn" onClick={() => executer(etape)}>
          {etape.texte} ({etape.pieces.length > 1 ? `${etape.pieces.length} pièces` : idx.pieces.get(etape.pieces[0])?.nom})
        </button>
      )}
      {termine && <p className="bilan-ok">Remontage terminé.</p>}
      <div className="fiche-actions">
        <button className="chip" onClick={annuler} disabled={!historique.length}>Annuler</button>
        <button className="chip" onClick={reinitialiser}>Réinitialiser</button>
        <button className={`chip${manipulation === 'piece' ? ' chip-active' : ''}`} onClick={() => setManipulation(manipulation === 'piece' ? 'vue' : 'piece')}>
          Remonter à la main
        </button>
      </div>
      {manipulation === 'piece' && (
        <p className="muted">Faites glisser une pièce déposée vers sa place : elle s'aimante quand elle en est proche et que l'ordre de remontage le permet.</p>
      )}
      {selection && idx.pieces.has(selection.id) && (
        <p className="muted">
          {selection.nom} : {ETAT_LIBELLE[etat[selection.id]]}.{' '}
          {actionsPossibles(idx, etat, selection.id).filter((a) => a.ok).map((a) => (
            <button key={a.action} className="lien" onClick={() => agir(a.action, selection.id)}>{a.libelle}</button>
          ))}
        </p>
      )}
      <p className={`ecart-pose${enPlace ? '' : ' muted'}`} data-ecart={ecart}>
        {enPlace ? <>Écart à la pose de référence : <strong>{mmTexte(ecart)}</strong></> : 'Écart à la pose de référence : mesuré quand toutes les pièces sont en place.'}
      </p>
    </div>
  );
}

function PanneauReglages({ manifeste, mode, eclate, setEclate, coupe, setCoupe, articulations, setArticulations, etatSignal, setEtatSignal, calage, setCalage, opacite, setOpacite, reperesSeuls, setReperesSeuls, manipule, remettre, surMarqueur, setSurMarqueur, marqueurLu, equipementLu, autreMaquette, ouvrir, vocal }) {
  return (
    <div className="reglages">
      <label htmlFor="eclate">Vue éclatée <span className="muted">(ne change pas l'état du démontage)</span></label>
      <input id="eclate" type="range" min="0" max="1" step="0.01" value={eclate} onChange={(e) => setEclate(Number(e.target.value))} />
      {manifeste.coupe && (
        <>
          <label className="case">
            <input type="checkbox" checked={coupe.actif} onChange={(e) => setCoupe({ ...coupe, actif: e.target.checked })} />
            {manifeste.coupe.libelle}{manifeste.statut === 'coupe_de_principe' ? ' (de principe)' : ''}
          </label>
          {coupe.actif && (
            <input aria-label="Position de la coupe" type="range" min="0" max="1" step="0.01" value={coupe.position}
              onChange={(e) => setCoupe({ ...coupe, position: Number(e.target.value) })} />
          )}
        </>
      )}
      {manifeste.articulations?.map((a) => (
        <div key={a.id}>
          <label htmlFor={`art-${a.id}`}>{a.libelle} <span className="muted">{(articulations[a.id] ?? a.valeur).toLocaleString('fr-FR')} {a.unite}</span></label>
          <input id={`art-${a.id}`} type="range" min={a.min} max={a.max} step={a.pas} value={articulations[a.id] ?? a.valeur}
            onChange={(e) => setArticulations({ ...articulations, [a.id]: Number(e.target.value) })} />
        </div>
      ))}
      {manifeste.etats?.length > 0 && (
        <>
          <label htmlFor="etat-signal">État affiché (simulation pédagogique)</label>
          <select id="etat-signal" className="filter-select" value={etatSignal} onChange={(e) => setEtatSignal(e.target.value)}>
            {manifeste.etats.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
          </select>
        </>
      )}
      <button className="chip" disabled={!manipule} onClick={remettre}>Remettre les pièces déplacées en place</button>
      {vocal?.etat === 'ecoute' && <p className="muted voix-etat" role="status">Commande vocale à l'écoute{vocal.entendu ? ` · entendu : « ${vocal.entendu} »` : ''}</p>}
      {mode === 'camera' && (
        <div className="reglages-ra">
          <h3>Calage sur l'équipement</h3>
          <label className="case">
            <input type="checkbox" checked={surMarqueur} onChange={(e) => setSurMarqueur(e.target.checked)} /> Caler sur le marqueur QR de l'équipement
          </label>
          {surMarqueur && marqueurLu && (
            <p className="muted marqueur-etat">
              Marqueur lu : <strong>{marqueurLu.texte}</strong>{equipementLu ? ` · ${equipementLu.code}` : ' · aucun équipement ne porte ce marqueur'}
            </p>
          )}
          {autreMaquette && <button className="chip" onClick={() => ouvrir(autreMaquette)}>Ouvrir la maquette de {equipementLu.code}</button>}
          <p className="muted">{surMarqueur ? 'La maquette suit le marqueur ; « Taille » règle sa grandeur par rapport au marqueur.' : "Superposition approximative, à l'œil."}</p>
          {[['echelle', 'Taille', 0.1, 3, 0.01], ['x', 'Gauche ou droite', -1.5, 1.5, 0.01], ['y', 'Haut ou bas', -1.5, 1.5, 0.01], ['rotation', 'Rotation', -180, 180, 1]].map(([cle, libelle, min, max, pas]) => (
            <div key={cle}>
              <label htmlFor={`ra-${cle}`}>{libelle}</label>
              <input id={`ra-${cle}`} type="range" min={min} max={max} step={pas} value={calage[cle]}
                onChange={(e) => setCalage({ ...calage, [cle]: Number(e.target.value) })} />
            </div>
          ))}
          <label htmlFor="ra-opacite">Opacité de la maquette</label>
          <input id="ra-opacite" type="range" min="0.2" max="1" step="0.05" value={opacite} onChange={(e) => setOpacite(Number(e.target.value))} />
          <label className="case">
            <input type="checkbox" checked={reperesSeuls} onChange={(e) => setReperesSeuls(e.target.checked)} /> Repères seuls
          </label>
          <button className="chip" onClick={() => setCalage(CALAGE)}>Réinitialiser le calage</button>
        </div>
      )}
    </div>
  );
}

function PanneauSources({ manifeste, integrite }) {
  return (
    <div className="sources">
      <dl className="cotes">
        <div><dt>Variante représentée</dt><dd>{manifeste.variante}</dd></div>
        <div><dt>Statut documentaire</dt><dd>{manifeste.statutLibelle}</dd></div>
        <div><dt>Version</dt><dd>{manifeste.version}</dd></div>
        <div><dt>Échelle 1:1 en RA</dt><dd>{manifeste.echelle?.ra_1_1 ? 'Autorisée' : 'Non validée'}</dd></div>
        <div><dt>Intégrité du fichier</dt><dd>{integrite === 'verifiee' ? 'Vérifiée (SHA-256)' : 'Non vérifiable ici'}</dd></div>
      </dl>
      <h3>Cotes</h3>
      <table className="table table-cotes">
        <thead><tr><th>Cote</th><th>Valeur</th><th>Statut</th></tr></thead>
        <tbody>
          {manifeste.cotes.map((c) => (
            <tr key={c.libelle}><td>{c.libelle}</td><td>{c.valeur} {c.unite}</td><td>{STATUTS_COTE[c.statut] || c.statut}</td></tr>
          ))}
        </tbody>
      </table>
      <h3>Sources</h3>
      <ul className="liste-sources">
        {manifeste.sources.map((s) => (
          <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.editeur} : {s.titre}</a>, {s.page}</li>
        ))}
      </ul>
      <h3>Simplifications</h3>
      <ul>{manifeste.simplifications.map((t) => <li key={t}>{t}</li>)}</ul>
      <h3>Plans exacts à obtenir de CAMRAIL</h3>
      <ul>{manifeste.plansManquants.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}

function PanneauHorsLigne({ catalogue, horsLigne }) {
  const [etats, setEtats] = useState(null);
  const [avance, setAvance] = useState(null);
  const [erreur, setErreur] = useState('');
  const lire = useCallback(() => etatHorsLigne(catalogue).then(setEtats), [catalogue]);
  useEffect(() => { lire(); }, [lire]);
  const preparer = async () => {
    setErreur('');
    try {
      await preparerHorsLigne(catalogue, null, (n, total) => setAvance(`${n} / ${total}`));
    } catch (e) { setErreur(e.message); }
    setAvance(null);
    lire();
  };
  const libelles = { integre: 'Disponible, intègre', presente: 'Disponible', alteree: 'Copie altérée', absente: 'Non téléchargée' };
  return (
    <div className="hors-ligne">
      <p className="muted">Les maquettes préparées restent consultables sans réseau, à la version indiquée.</p>
      <button className="primary-btn" onClick={preparer} disabled={Boolean(avance) || horsLigne}>
        {avance ? `Téléchargement ${avance}` : 'Préparer la visite hors ligne'}
      </button>
      {erreur && <p className="scan-error">{erreur}</p>}
      <ul className="liste-hors-ligne">
        {catalogue.actifs.map((a) => (
          <li key={a.actif}>
            <span>{a.titre} <span className="muted">v{a.version}</span></span>
            <span className={`hl-${etats?.[a.actif] || 'absente'}`}>{etats ? libelles[etats[a.actif]] : '…'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RaSuivie({ capacites, xr, lancer, scene }) {
  const pret = capacites?.https && capacites?.webxr && capacites?.immersiveAr;
  const SUIVI = { recherche: 'Recherche d\'une surface…', bon: 'Suivi correct', limite: 'Suivi limité', perdu: 'Suivi perdu : repères masqués' };
  if (xr) {
    return (
      <div className="xr-commandes">
        <p className={`xr-suivi xr-${xr.suivi}`}>{SUIVI[xr.suivi] || xr.suivi}</p>
        <p>{xr.place ? 'Maquette posée à titre de démonstration.' : 'Visez le sol puis touchez l\'écran pour poser la maquette.'}</p>
        <button className="chip" onClick={() => scene.current?.reancrer()}>Réancrer</button>
        <button className="chip" onClick={() => scene.current?.quitterXR()}>Quitter la RA</button>
      </div>
    );
  }
  return (
    <div className="xr-panneau">
      <h3>RA suivie sur terminal compatible</h3>
      <ul className="capacites">
        <li className={capacites?.https ? 'ok' : 'ko'}>Contexte sécurisé (HTTPS) : {capacites ? (capacites.https ? 'oui' : 'non') : '…'}</li>
        <li className={capacites?.webxr ? 'ok' : 'ko'}>WebXR : {capacites ? (capacites.webxr ? 'présent' : 'absent') : '…'}</li>
        <li className={capacites?.immersiveAr ? 'ok' : 'ko'}>Session immersive-ar : {capacites ? (capacites.immersiveAr ? 'prise en charge' : 'non prise en charge') : '…'}</li>
      </ul>
      <p className="muted">
        <strong>Placement de démonstration</strong> : la maquette est posée sur une surface détectée (hit-test), à échelle réduite.
        Ce n'est pas un <strong>recalage sur l'équipement réel</strong> : viser une pièce réelle demande une cible ou un recalage
        géométrique validé sur la variante exacte, à tester en atelier.
      </p>
      <button className="primary-btn" disabled={!pret} onClick={lancer}>Placer la maquette (démonstration)</button>
      {capacites && !pret && <p className="muted">Ce terminal ne permet pas la RA suivie : utilisez l'atelier 3D ou la caméra avec calage manuel.</p>}
    </div>
  );
}
