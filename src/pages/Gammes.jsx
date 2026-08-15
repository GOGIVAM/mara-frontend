import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Plus } from '../components/Icons.jsx';
import {
  CLASSES, DIRECTIONS, SAFETY_CLASS, SAFETY_LABELS, SAFETY_LEVELS, classLabel, timestamp,
} from '../lib/format.js';

const EMPTY_GAMME = { code: '', titre: '', classeEquipement: CLASSES[0], direction: 'DMAT', equipementId: '', isActive: true };
const EMPTY_ETAPE = { ordreIndex: 1, description: '', niveauSecurite: 'NONE', dureeSecondes: '', arContentRef: '', detail: '' };

/** Gammes de maintenance et étapes  /api/gammes (+ /etapes). */
export default function Gammes() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [filters, setFilters] = useState({ direction: '', classeEquipement: '', activeOnly: 'true' });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [equipements, setEquipements] = useState([]);
  const [gammeForm, setGammeForm] = useState(null);
  const [etapeForm, setEtapeForm] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const load = () => api.gammes(filters).then((l) => {
    setList(l);
    setSelectedId((prev) => (l.some((g) => g.id === prev) ? prev : l[0]?.id || null));
  }).catch((e) => setFeedback({ error: e.message }));

  useEffect(() => { load(); }, [filters.direction, filters.classeEquipement, filters.activeOnly]);
  useEffect(() => { api.equipements().then(setEquipements).catch(() => {}); }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    api.gamme(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const reloadDetail = async () => setDetail(await api.gamme(selectedId));

  const saveGamme = async (e) => {
    e.preventDefault();
    setFeedback(null);
    const body = { ...gammeForm, equipementId: gammeForm.equipementId || null };
    try {
      const saved = gammeForm.id ? await api.updateGamme(gammeForm.id, body) : await api.createGamme(body);
      setGammeForm(null);
      await load();
      if (saved?.id) setSelectedId(saved.id);
      setFeedback({ ok: 'Gamme enregistrée.' });
    } catch (err) { setFeedback({ error: err.message }); }
  };

  const removeGamme = async () => {
    if (!detail || !window.confirm(`Supprimer la gamme ${detail.code} ?`)) return;
    try { await api.deleteGamme(detail.id); setSelectedId(null); await load(); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  const saveEtape = async (e) => {
    e.preventDefault();
    setFeedback(null);
    const body = {
      ordreIndex: Number(etapeForm.ordreIndex),
      description: etapeForm.description,
      arContentRef: etapeForm.arContentRef || null,
      niveauSecurite: etapeForm.niveauSecurite,
      dureeSecondes: etapeForm.dureeSecondes === '' ? null : Number(etapeForm.dureeSecondes),
      detail: etapeForm.detail || null,
    };
    try {
      if (etapeForm.id) await api.updateEtape(detail.id, etapeForm.id, body);
      else await api.addEtape(detail.id, body);
      setEtapeForm(null);
      await reloadDetail();
      setFeedback({ ok: 'Étape enregistrée.' });
    } catch (err) { setFeedback({ error: err.message }); }
  };

  const removeEtape = async (etape) => {
    if (!window.confirm('Supprimer cette étape ?')) return;
    try { await api.deleteEtape(detail.id, etape.id); await reloadDetail(); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  return (
    <div className="page two-col-wide">
      <section className="card panel">
        <header className="panel-head">
          <h3>Gammes de maintenance</h3>
          <div className="filters">
            {['', ...DIRECTIONS].map((d) => (
              <button key={d || 'all'} className={`chip${filters.direction === d ? ' chip-active' : ''}`}
                onClick={() => setFilters({ ...filters, direction: d })}>{d || 'Toutes'}</button>
            ))}
            <select className="filter-select" value={filters.classeEquipement}
              onChange={(e) => setFilters({ ...filters, classeEquipement: e.target.value })}>
              <option value="">Toutes les classes</option>
              {CLASSES.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
            </select>
            <select className="filter-select" value={filters.activeOnly}
              onChange={(e) => setFilters({ ...filters, activeOnly: e.target.value })}>
              <option value="true">Actives</option>
              <option value="false">Toutes</option>
            </select>
            {isAdmin && (
              <button className="chip chip-active" onClick={() => setGammeForm({ ...EMPTY_GAMME })}>
                <Plus size={13} /> Nouvelle
              </button>
            )}
          </div>
        </header>

        {feedback?.error && <p className="login-error">{feedback.error}</p>}
        {feedback?.ok && <p className="form-ok">{feedback.ok}</p>}

        <table className="table">
          <thead>
            <tr><th>Code</th><th>Titre</th><th>Classe</th><th>Dir.</th><th>Ver.</th><th>Étapes</th><th>Maj</th></tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.id} className={selectedId === g.id ? 'row-active' : ''} onClick={() => setSelectedId(g.id)}>
                <td>{g.code}</td>
                <td>{g.titre}{!g.isActive && <span className="badge" style={{ marginLeft: 6 }}>inactive</span>}</td>
                <td>{classLabel(g.classeEquipement)}</td>
                <td>{g.direction}</td>
                <td className="muted">v{g.version}</td>
                <td>{g.nbEtapes}</td>
                <td className="muted">{timestamp(g.updatedAt)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="muted">Aucune gamme.</td></tr>}
          </tbody>
        </table>
      </section>

      <aside className="card panel">
        {gammeForm ? (
          <>
            <header className="panel-head"><h3>{gammeForm.id ? 'Modifier la gamme' : 'Nouvelle gamme'}</h3></header>
            <form className="form-stack" onSubmit={saveGamme}>
              <label>Code
                <input required maxLength={50} value={gammeForm.code}
                  onChange={(e) => setGammeForm({ ...gammeForm, code: e.target.value })} />
              </label>
              <label>Titre
                <input required maxLength={200} value={gammeForm.titre}
                  onChange={(e) => setGammeForm({ ...gammeForm, titre: e.target.value })} />
              </label>
              <label>Classe d'équipement
                <select value={gammeForm.classeEquipement}
                  onChange={(e) => setGammeForm({ ...gammeForm, classeEquipement: e.target.value })}>
                  {CLASSES.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
                </select>
              </label>
              <label>Direction
                <select value={gammeForm.direction}
                  onChange={(e) => setGammeForm({ ...gammeForm, direction: e.target.value })}>
                  {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label>Équipement rattaché
                <select value={gammeForm.equipementId || ''}
                  onChange={(e) => setGammeForm({ ...gammeForm, equipementId: e.target.value })}>
                  <option value="">Aucun</option>
                  {equipements.map((e) => <option key={e.id} value={e.id}>{e.code}  {e.designation}</option>)}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={gammeForm.isActive}
                  onChange={(e) => setGammeForm({ ...gammeForm, isActive: e.target.checked })} />
                Gamme active
              </label>
              <div className="form-actions">
                <button className="primary-btn">Enregistrer</button>
                <button type="button" className="chip" onClick={() => setGammeForm(null)}>Annuler</button>
              </div>
            </form>
          </>
        ) : detail ? (
          <>
            <header className="panel-head">
              <h3>Détail de la gamme</h3>
              {isAdmin && (
                <div className="filters">
                  <button className="chip" onClick={() => setGammeForm({
                    id: detail.id, code: detail.code, titre: detail.titre,
                    classeEquipement: detail.classeEquipement, direction: detail.direction,
                    equipementId: detail.equipementId || '', isActive: detail.isActive,
                  })}>Modifier</button>
                  <button className="chip" onClick={removeGamme}>Supprimer</button>
                </div>
              )}
            </header>
            <div className="detail">
              <p className="detail-title">{detail.code}  {detail.titre}</p>
              <p className="muted">
                {classLabel(detail.classeEquipement)} · {detail.direction} · v{detail.version}
                {detail.isActive ? '' : ' · inactive'}
              </p>

              <div className="panel-head" style={{ marginTop: 14 }}>
                <h4>Étapes ({(detail.etapes || []).length})</h4>
                {isAdmin && (
                  <button className="chip" onClick={() => setEtapeForm({
                    ...EMPTY_ETAPE, ordreIndex: (detail.etapes || []).length + 1,
                  })}><Plus size={13} /> Ajouter</button>
                )}
              </div>

              {etapeForm && (
                <form className="form-stack" onSubmit={saveEtape} style={{ marginBottom: 16 }}>
                  <label>Ordre
                    <input type="number" min={0} max={999} required value={etapeForm.ordreIndex}
                      onChange={(e) => setEtapeForm({ ...etapeForm, ordreIndex: e.target.value })} />
                  </label>
                  <label>Description (80 caractères max  contrainte RealWear)
                    <input required maxLength={80} value={etapeForm.description}
                      onChange={(e) => setEtapeForm({ ...etapeForm, description: e.target.value })} />
                  </label>
                  <label>Niveau de sécurité
                    <select value={etapeForm.niveauSecurite}
                      onChange={(e) => setEtapeForm({ ...etapeForm, niveauSecurite: e.target.value })}>
                      {SAFETY_LEVELS.map((s) => <option key={s} value={s}>{SAFETY_LABELS[s]}</option>)}
                    </select>
                  </label>
                  <label>Durée (secondes)
                    <input type="number" min={0} max={86400} value={etapeForm.dureeSecondes}
                      onChange={(e) => setEtapeForm({ ...etapeForm, dureeSecondes: e.target.value })} />
                  </label>
                  <label>Référence contenu AR
                    <input maxLength={200} value={etapeForm.arContentRef || ''}
                      onChange={(e) => setEtapeForm({ ...etapeForm, arContentRef: e.target.value })} />
                  </label>
                  <label>Détail
                    <textarea rows={2} value={etapeForm.detail || ''}
                      onChange={(e) => setEtapeForm({ ...etapeForm, detail: e.target.value })} />
                  </label>
                  <div className="form-actions">
                    <button className="primary-btn">Enregistrer l'étape</button>
                    <button type="button" className="chip" onClick={() => setEtapeForm(null)}>Annuler</button>
                  </div>
                </form>
              )}

              <ol className="steps">
                {(detail.etapes || []).map((s) => (
                  <li key={s.id} className={`step step-${SAFETY_CLASS[s.niveauSecurite] || 'vert'}`}>
                    <span className="step-order">{String(s.ordreIndex).padStart(2, '0')}</span>
                    <span className="step-body">
                      <strong>{s.description}</strong>
                      <span className="muted">
                        {SAFETY_LABELS[s.niveauSecurite] || s.niveauSecurite}
                        {s.dureeSecondes ? ` · ${Math.round(s.dureeSecondes / 60)} min` : ''}
                        {s.arContentRef ? ` · ${s.arContentRef}` : ''}
                      </span>
                      {s.detail && <span className="muted">{s.detail}</span>}
                      {isAdmin && (
                        <span className="step-tools">
                          <button className="step-check" onClick={() => setEtapeForm({
                            id: s.id, ordreIndex: s.ordreIndex, description: s.description,
                            niveauSecurite: s.niveauSecurite, dureeSecondes: s.dureeSecondes ?? '',
                            arContentRef: s.arContentRef || '', detail: s.detail || '',
                          })}>Modifier</button>
                          <button className="step-check" onClick={() => removeEtape(s)}>Supprimer</button>
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {!(detail.etapes || []).length && <li className="muted">Aucune étape définie.</li>}
              </ol>
            </div>
          </>
        ) : <p className="muted">Sélectionnez une gamme.</p>}
      </aside>
    </div>
  );
}
