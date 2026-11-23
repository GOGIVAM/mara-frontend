import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Plus } from '../components/Icons.jsx';
import { STATUTS as STATUTS_MAQUETTE, chargerCatalogue, lienMaquette, resoudre } from '../lib/maquettes.js';
import {
  CLASSES, DIRECTIONS, STATUTS, STATUT_LABELS, classLabel, timestamp,
} from '../lib/format.js';

const EMPTY = {
  code: '', designation: '', classe: CLASSES[0], direction: 'DMAT',
  marqueur: '', statut: 'actif', description: '',
};

/** Référentiel équipements  GET/POST/PUT/DELETE /api/equipements. */
export default function Equipements() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ direction: '', classe: '', statut: '' });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [catalogue, setCatalogue] = useState(null);

  useEffect(() => { chargerCatalogue().then((r) => setCatalogue(r.catalogue)).catch(() => {}); }, []);
  const maquette = selected && resoudre(catalogue, { code: selected.code, classe: selected.classe });

  const load = () => api.equipements(filters).then((list) => {
    setItems(list);
    setSelected((prev) => list.find((e) => e.id === prev?.id) || list[0] || null);
  }).catch((e) => setFeedback({ error: e.message }));

  useEffect(() => { load(); }, [filters.direction, filters.classe, filters.statut]);

  const visible = items.filter((e) => {
    const q = search.trim().toLowerCase();
    return !q || `${e.code} ${e.designation} ${e.marqueur || ''}`.toLowerCase().includes(q);
  });

  const save = async (e) => {
    e.preventDefault();
    setFeedback(null);
    const body = { ...form, marqueur: form.marqueur || null, description: form.description || null };
    try {
      if (form.id) await api.updateEquipement(form.id, body);
      else await api.createEquipement(body);
      setFeedback({ ok: form.id ? 'Équipement mis à jour.' : 'Équipement créé.' });
      setForm(null);
      await load();
    } catch (err) { setFeedback({ error: err.message }); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Supprimer définitivement ${item.code} ?`)) return;
    try { await api.deleteEquipement(item.id); await load(); setFeedback({ ok: 'Équipement supprimé.' }); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  return (
    <div className="page two-col-wide">
      <section className="card panel">
        <header className="panel-head">
          <h3>Parc d'équipements</h3>
          <div className="filters">
            <input placeholder="Rechercher un code, un marqueur…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
            {['', ...DIRECTIONS].map((d) => (
              <button key={d || 'all'} className={`chip${filters.direction === d ? ' chip-active' : ''}`}
                onClick={() => setFilters({ ...filters, direction: d })}>{d || 'Toutes'}</button>
            ))}
            <select className="filter-select" value={filters.classe}
              onChange={(e) => setFilters({ ...filters, classe: e.target.value })}>
              <option value="">Toutes les classes</option>
              {CLASSES.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
            </select>
            <select className="filter-select" value={filters.statut}
              onChange={(e) => setFilters({ ...filters, statut: e.target.value })}>
              <option value="">Tous les statuts</option>
              {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
            </select>
            {isAdmin && (
              <button className="chip chip-active" onClick={() => setForm({ ...EMPTY })}>
                <Plus size={13} /> Nouveau
              </button>
            )}
          </div>
        </header>

        {feedback?.error && <p className="login-error">{feedback.error}</p>}
        {feedback?.ok && <p className="form-ok">{feedback.ok}</p>}

        <table className="table">
          <thead>
            <tr><th>Code</th><th>Désignation</th><th>Classe</th><th>Dir.</th><th>Gammes</th><th>Docs</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id} className={selected?.id === e.id ? 'row-active' : ''} tabIndex={0} onClick={() => setSelected(e)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') (() => setSelected(e))(); }}>
                <td>{e.code}</td>
                <td>{e.designation}</td>
                <td>{classLabel(e.classe)}</td>
                <td>{e.direction}</td>
                <td>{e.nbGammes}</td>
                <td>{e.nbDocuments}</td>
                <td><span className={`badge statut-${e.statut}`}>{STATUT_LABELS[e.statut] || e.statut}</span></td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={7} className="muted">Aucun équipement.</td></tr>}
          </tbody>
        </table>
      </section>

      <aside className="card panel">
        {form ? (
          <>
            <header className="panel-head"><h3>{form.id ? 'Modifier' : 'Nouvel équipement'}</h3></header>
            <form className="form-stack" onSubmit={save}>
              <label>Code
                <input required maxLength={50} value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <label>Désignation
                <input required maxLength={200} value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </label>
              <label>Classe IA
                <select value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })}>
                  {CLASSES.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
                </select>
              </label>
              <label>Direction
                <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                  {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label>Marqueur
                <input maxLength={100} value={form.marqueur || ''}
                  onChange={(e) => setForm({ ...form, marqueur: e.target.value })} />
              </label>
              <label>Statut
                <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                  {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </label>
              <label>Description
                <textarea rows={3} value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <div className="form-actions">
                <button className="primary-btn">Enregistrer</button>
                <button type="button" className="chip" onClick={() => setForm(null)}>Annuler</button>
              </div>
            </form>
          </>
        ) : selected ? (
          <>
            <header className="panel-head">
              <h3>Fiche équipement</h3>
              {isAdmin && (
                <div className="filters">
                  <button className="chip" onClick={() => setForm({ ...selected })}>Modifier</button>
                  <button className="chip" onClick={() => remove(selected)}>Supprimer</button>
                </div>
              )}
            </header>
            <div className="detail">
              <p className="detail-title">{selected.designation}</p>
              <dl>
                <div><dt>Code</dt><dd>{selected.code}</dd></div>
                <div><dt>Classe IA</dt><dd>{classLabel(selected.classe)}</dd></div>
                <div><dt>Direction</dt><dd>{selected.direction}</dd></div>
                <div><dt>Marqueur</dt><dd>{selected.marqueur || ''}</dd></div>
                <div><dt>Statut</dt><dd>{STATUT_LABELS[selected.statut] || selected.statut}</dd></div>
                <div><dt>Gammes rattachées</dt><dd>{selected.nbGammes}</dd></div>
                <div><dt>Documents</dt><dd>{selected.nbDocuments}</dd></div>
                <div><dt>Mise à jour</dt><dd>{timestamp(selected.updatedAt)}</dd></div>
              </dl>
              {selected.description && <p className="muted">{selected.description}</p>}
              <div className="fiche-maquette">
                <h4>Maquette 2D / 3D</h4>
                {maquette ? (
                  <>
                    <p><strong>{maquette.titre}</strong> · version {maquette.version}</p>
                    <p className="muted">Variante représentée : {maquette.variante}</p>
                    <p><span className={`badge ${STATUTS_MAQUETTE[maquette.statut]?.classe || ''}`}>{STATUTS_MAQUETTE[maquette.statut]?.libelle}</span>{' '}
                      <span className="muted">{maquette.statutLibelle}</span></p>
                    <Link className="primary-btn lien-maquette" to={lienMaquette({ actif: maquette.actif, code: selected.code, mode: 'plan' })}>
                      Ouvrir la maquette
                    </Link>
                  </>
                ) : <p className="muted">{catalogue ? 'Aucune maquette pour cette classe.' : 'Catalogue des maquettes en cours de chargement.'}</p>}
              </div>
            </div>
          </>
        ) : <p className="muted">Sélectionnez un équipement.</p>}
      </aside>
    </div>
  );
}
