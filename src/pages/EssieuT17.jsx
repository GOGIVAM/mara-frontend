import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { SAFETY_CLASS, SAFETY_LABELS } from '../lib/format.js';
import { cue, speak, stopSpeaking } from '../t17/audio.js';
import {
  CONTROL_POINTS, PARTS, STEPS, T17, can, pointById, stepsToEtapes,
} from '../t17/model.js';

// three.js n'est chargé qu'à l'ouverture de cet écran.
const AxleViewer = lazy(() => import('../t17/AxleViewer.jsx'));

const FICHE_KEY = 'mara.t17.fiche';
const emptyFiche = (agent) => ({
  numero: '', agent: agent || '', date: new Date().toISOString().slice(0, 10), points: {}, steps: {},
});
const loadFiche = (agent) => {
  try { return JSON.parse(localStorage.getItem(FICHE_KEY)) || emptyFiche(agent); }
  catch { return emptyFiche(agent); }
};

const TABS = [
  { key: 'jumeau', label: 'Jumeau numérique', right: 'view' },
  { key: 'operatoire', label: 'Mode opératoire', right: 'view' },
  { key: 'formation', label: 'Formation', right: 'train' },
  { key: 'fiche', label: 'Fiche de contrôle', right: 'execute' },
];

const fmtDuree = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

/** Module essieu T17 : jumeau numérique 3D, mode opératoire pas à pas, fiche de contrôle. */
export default function EssieuT17() {
  const { user } = useAuth();
  const groupe = user?.groupe;
  const tabs = TABS.filter((t) => can(groupe, t.right));
  const [tab, setTab] = useState(tabs[0]?.key);
  const [pointId, setPointId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [voice, setVoice] = useState(false);
  const [fiche, setFiche] = useState(() => loadFiche(user?.userName));
  const [feedback, setFeedback] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const stepMode = tab === 'operatoire' || tab === 'formation';
  const step = STEPS[stepIndex];

  useEffect(() => {
    try { localStorage.setItem(FICHE_KEY, JSON.stringify(fiche)); } catch { /* stockage indisponible */ }
  }, [fiche]);

  useEffect(() => () => stopSpeaking(), []);

  // Pilotage de la vue 3D selon l'onglet et l'étape.
  const viewPoint = stepMode ? step.point : pointId;
  const animation = stepMode ? step.animation : (pointId ? 'focus' : 'overview');
  const highlightPart = pointById(viewPoint)?.part || null;

  const announce = useCallback((index) => {
    const s = STEPS[index];
    cue(s.niveauSecurite === 'ROUGE' ? 'alert' : 'next');
    if (voice) {
      const extra = tab === 'formation' ? [s.detail, pointById(s.point)?.critere].filter(Boolean).join('. ') : '';
      speak(`Étape ${s.ordre}. ${s.description}. ${extra}`);
    }
  }, [voice, tab]);

  const goStep = useCallback((index) => {
    const i = Math.max(0, Math.min(STEPS.length - 1, index));
    setStepIndex(i);
    announce(i);
  }, [announce]);

  // Navigation clavier (et commandes vocales RealWear mappées sur les boutons).
  useEffect(() => {
    if (!stepMode) return undefined;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goStep(stepIndex + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goStep(stepIndex - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepMode, stepIndex, goStep]);

  const statuses = useMemo(() => Object.fromEntries(
    Object.entries(fiche.points).filter(([, v]) => v.statut).map(([k, v]) => [k, v.statut]),
  ), [fiche.points]);

  const setPoint = (id, patch) => setFiche((f) => ({
    ...f, points: { ...f.points, [id]: { ...f.points[id], ...patch } },
  }));
  const toggleStep = (ordre) => setFiche((f) => ({ ...f, steps: { ...f.steps, [ordre]: !f.steps[ordre] } }));

  const finish = () => {
    const ko = CONTROL_POINTS.filter((p) => fiche.points[p.id]?.statut === 'non_conforme').length;
    cue(ko ? 'ko' : 'done');
    setFeedback(ko
      ? { error: `${ko} point(s) non conforme(s) : l'essieu doit être retiré du service et signalé à la DMAT.` }
      : { ok: 'Mode opératoire terminé. Complétez et exportez la fiche de contrôle.' });
  };

  const exportCsv = () => {
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Essieu', 'Numéro', 'Agent', 'Date'].map(esc).join(';'),
      [T17.code, fiche.numero, fiche.agent, fiche.date].map(esc).join(';'),
      '',
      ['Point', 'Libellé', 'Instrument', 'Statut', 'Valeur', 'Unité', 'Commentaire'].map(esc).join(';'),
      ...CONTROL_POINTS.map((p) => {
        const r = fiche.points[p.id] || {};
        return [p.id, p.label, p.instrument, r.statut || 'non renseigné', r.valeur, p.unite, r.commentaire].map(esc).join(';');
      }),
      '',
      ['Étape', 'Description', 'Réalisée'].map(esc).join(';'),
      ...STEPS.map((s) => [s.ordre, s.description, fiche.steps[s.ordre] ? 'oui' : 'non'].map(esc).join(';')),
    ];
    const blob = new Blob([`﻿${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiche-T17-${fiche.numero || 'sans-numero'}-${fiche.date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resetFiche = () => {
    if (!window.confirm('Effacer la fiche de contrôle en cours ?')) return;
    setFiche(emptyFiche(user?.userName));
  };

  // Publication du mode opératoire comme gamme back-end (lue par l'application AR).
  const publish = async () => {
    setPublishing(true); setFeedback(null);
    try {
      const body = {
        code: T17.gammeCode, titre: T17.gammeTitre, classeEquipement: T17.classe,
        direction: T17.direction, equipementId: null, isActive: true,
      };
      const existing = (await api.gammes({ classeEquipement: T17.classe, activeOnly: 'false' }))
        .find((g) => g.code === T17.gammeCode);
      let gammeId = existing?.id;
      if (existing) {
        if (!window.confirm(`La gamme ${T17.gammeCode} existe déjà (v${existing.version}). Remplacer ses étapes ?`)) return;
        await api.updateGamme(existing.id, body);
        const detail = await api.gamme(existing.id);
        for (const e of detail.etapes || []) await api.deleteEtape(existing.id, e.id);
      } else {
        gammeId = (await api.createGamme(body)).id;
      }
      for (const etape of stepsToEtapes()) await api.addEtape(gammeId, etape);
      setFeedback({ ok: `Gamme ${T17.gammeCode} publiée avec ${STEPS.length} étapes.` });
    } catch (err) {
      setFeedback({ error: err.message });
    } finally {
      setPublishing(false);
    }
  };

  if (!can(groupe, 'view')) {
    return (
      <div className="page">
        <section className="card panel">
          <h3>Essieu T17</h3>
          <p className="muted">Le module essieu T17 est réservé aux groupes DMAT, CI, CIF et ADMIN.</p>
        </section>
      </div>
    );
  }

  const selected = pointById(viewPoint);

  return (
    <div className="page">
      <section className="card panel t17-head">
        <div>
          <h3>Essieu {T17.code} · maintenance augmentée</h3>
          <p className="muted">
            Jumeau numérique, mode opératoire en {STEPS.length} étapes et {CONTROL_POINTS.length} points de contrôle.
            Tolérances chiffrées à compléter avec la documentation technique T17 de la DMAT.
          </p>
        </div>
        <div className="filters">
          {tabs.map((t) => (
            <button key={t.key} className={`chip${tab === t.key ? ' chip-active' : ''}`}
              onClick={() => { setTab(t.key); setFeedback(null); }}>{t.label}</button>
          ))}
          {can(groupe, 'publish') && (
            <button className="chip" onClick={publish} disabled={publishing}
              title="Créer ou mettre à jour la gamme dans le back-end">
              {publishing ? 'Publication…' : 'Publier la gamme'}
            </button>
          )}
        </div>
      </section>

      {feedback?.error && <p className="login-error">{feedback.error}</p>}
      {feedback?.ok && <p className="form-ok">{feedback.ok}</p>}

      <div className="two-col-wide">
        <section className="card panel">
          <Suspense fallback={<div className="viewer viewer-failed"><p className="muted">Chargement du jumeau numérique…</p></div>}>
            <AxleViewer
              selectedPoint={viewPoint}
              highlightPart={highlightPart}
              animation={animation}
              statuses={statuses}
              onSelectPoint={(id) => {
                if (stepMode) {
                  const i = STEPS.findIndex((s) => s.point === id);
                  if (i >= 0) goStep(i);
                } else {
                  setPointId(id === pointId ? null : id);
                  cue('next');
                }
              }}
            />
          </Suspense>
          <p className="muted viewer-help">
            Glisser pour tourner, molette pour zoomer, clic droit pour déplacer. Cliquer un repère numéroté
            pour afficher le point de contrôle.
          </p>

          {stepMode && (
            <div className="t17-stepbar">
              <div className="progress"><span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} /></div>
              <div key={stepIndex} className={`step step-${SAFETY_CLASS[step.niveauSecurite]} t17-current`}>
                <span className="step-order">{String(step.ordre).padStart(2, '0')}</span>
                <span className="step-body">
                  <strong>{step.description}</strong>
                  <span className="muted">
                    <span className={`t17-safety-${step.niveauSecurite}`}>{SAFETY_LABELS[step.niveauSecurite]}</span> · {fmtDuree(step.duree)}
                    {selected ? ` · ${selected.label}` : ''}
                  </span>
                  {(tab === 'formation' || step.niveauSecurite !== 'NONE') && step.detail && (
                    <span className="t17-detail">{step.detail}</span>
                  )}
                  {tab === 'formation' && selected && (
                    <span className="t17-detail"><b>{selected.instrument}.</b> {selected.critere}</span>
                  )}
                </span>
              </div>
              <div className="form-actions">
                <button className="chip" onClick={() => goStep(stepIndex - 1)} disabled={stepIndex === 0}>Précédent</button>
                <button className="chip" onClick={() => announce(stepIndex)}>Répéter</button>
                {stepIndex < STEPS.length - 1
                  ? <button className="primary-btn" onClick={() => goStep(stepIndex + 1)}>Suivant</button>
                  : <button className="primary-btn" onClick={finish}>Terminer</button>}
                {tab === 'operatoire' && can(groupe, 'execute') && (
                  <label className="check">
                    <input type="checkbox" checked={!!fiche.steps[step.ordre]} onChange={() => toggleStep(step.ordre)} />
                    Étape réalisée
                  </label>
                )}
                <label className="check">
                  <input type="checkbox" checked={voice} onChange={(e) => { setVoice(e.target.checked); if (!e.target.checked) stopSpeaking(); }} />
                  Lecture vocale
                </label>
              </div>
            </div>
          )}
        </section>

        <aside className="card panel">
          <div className="swap" key={tab === 'jumeau' ? `jumeau-${pointId}` : tab}>
          {tab === 'jumeau' && (
            <>
              <header className="panel-head"><h3>{selected ? `${selected.id} · ${selected.label}` : 'Composition'}</h3></header>
              {selected ? (
                <div className="detail">
                  <dl>
                    <div><dt>Pièce</dt><dd>{PARTS[selected.part].label}</dd></div>
                    <div><dt>Instrument</dt><dd>{selected.instrument}</dd></div>
                    <div><dt>Tolérance</dt><dd>{selected.tolerance || 'À valider (documentation DMAT)'}</dd></div>
                  </dl>
                  <p className="muted">{selected.critere}</p>
                  <button className="chip" onClick={() => setPointId(null)}>Retour à la vue d'ensemble</button>
                </div>
              ) : (
                <ul className="kpi-list">
                  {Object.entries(PARTS).map(([k, p]) => (
                    <li key={k}>
                      <span className="kpi-label"><strong>{p.label}</strong></span>
                      <span className="kpi-value muted">{CONTROL_POINTS.filter((c) => c.part === k).length} pt</span>
                      <span className="kpi-threshold">{p.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {stepMode && (
            <>
              <header className="panel-head"><h3>Étapes</h3><span className="muted">← → pour naviguer</span></header>
              <ol className="steps t17-steps">
                {STEPS.map((s, i) => (
                  <li key={s.ordre}
                    className={`step step-${SAFETY_CLASS[s.niveauSecurite]}${i === stepIndex ? ' t17-step-active' : ''}`}
                    onClick={() => goStep(i)}>
                    <span className="step-order">{String(s.ordre).padStart(2, '0')}</span>
                    <span className="step-body">
                      <strong>{s.description}</strong>
                      <span className="muted">
                        <span className={`t17-safety-${s.niveauSecurite}`}>{SAFETY_LABELS[s.niveauSecurite]}</span> · {fmtDuree(s.duree)}
                        {fiche.steps[s.ordre] && tab === 'operatoire' ? ' · réalisée' : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {tab === 'fiche' && (
            <>
              <header className="panel-head">
                <h3>Fiche de contrôle</h3>
                <div className="filters">
                  <button className="chip" onClick={exportCsv}>Exporter CSV</button>
                  <button className="chip" onClick={resetFiche}>Nouvelle fiche</button>
                </div>
              </header>
              <div className="form-stack">
                <label>Numéro d'essieu
                  <input value={fiche.numero} maxLength={40} onChange={(e) => setFiche({ ...fiche, numero: e.target.value })} />
                </label>
                <label>Date
                  <input type="date" value={fiche.date} onChange={(e) => setFiche({ ...fiche, date: e.target.value })} />
                </label>
              </div>
              <ul className="t17-fiche">
                {CONTROL_POINTS.map((p) => {
                  const r = fiche.points[p.id] || {};
                  return (
                    <li key={p.id} className={pointId === p.id ? 't17-fiche-active' : ''} onClick={() => setPointId(p.id)}>
                      <strong>{p.id} · {p.label}</strong>
                      <span className="muted">{p.critere}</span>
                      <div className="filters">
                        {[['conforme', 'Conforme'], ['non_conforme', 'Non conforme']].map(([v, l]) => (
                          <button key={v} type="button"
                            className={`chip${r.statut === v ? ` chip-active chip-${v}` : ''}`}
                            onClick={(e) => { e.stopPropagation(); setPoint(p.id, { statut: r.statut === v ? '' : v }); cue(v === 'conforme' ? 'next' : 'ko'); }}>
                            {l}
                          </button>
                        ))}
                        {p.mesure && (
                          <input className="t17-mesure" placeholder={`Valeur (${p.unite})`} value={r.valeur || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setPoint(p.id, { valeur: e.target.value })} />
                        )}
                      </div>
                      <input placeholder="Commentaire" value={r.commentaire || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setPoint(p.id, { commentaire: e.target.value })} />
                    </li>
                  );
                })}
              </ul>
              <p className="muted">
                La fiche est conservée sur ce poste jusqu'à l'export. L'enregistrement côté serveur nécessite
                une route back-end dédiée (voir docs/conception-detaillee.md).
              </p>
            </>
          )}
          </div>
        </aside>
      </div>
    </div>
  );
}
