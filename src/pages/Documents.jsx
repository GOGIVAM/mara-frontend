import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Clip } from '../components/Icons.jsx';
import { TYPES_DOCUMENT, TYPE_DOC_LABELS, fileSize, timestamp } from '../lib/format.js';

/** Documents techniques  /api/documents (upload multipart, téléchargement authentifié). */
export default function Documents() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [equipements, setEquipements] = useState([]);
  const [filters, setFilters] = useState({ equipementId: '', typeDocument: '' });
  const [upload, setUpload] = useState({ typeDocument: 'manuel', equipementId: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const fileRef = useRef(null);

  const load = () => api.documents(filters).then(setItems).catch((e) => setFeedback({ error: e.message }));

  useEffect(() => { load(); }, [filters.equipementId, filters.typeDocument]);
  useEffect(() => { api.equipements().then(setEquipements).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setFeedback({ error: 'Sélectionnez un fichier.' }); return; }
    setBusy(true); setFeedback(null);
    try {
      await api.uploadDocument(file, upload);
      fileRef.current.value = '';
      setUpload({ ...upload, description: '' });
      setFeedback({ ok: 'Document téléversé.' });
      await load();
    } catch (err) { setFeedback({ error: err.message }); }
    finally { setBusy(false); }
  };

  const remove = async (doc) => {
    if (!window.confirm(`Supprimer ${doc.nomFichier} ?`)) return;
    try { await api.deleteDocument(doc.id); await load(); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  const download = async (doc) => {
    try { await api.downloadDocument(doc.id, doc.nomFichier); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  const equipementLabel = (id) => {
    const e = equipements.find((x) => x.id === id);
    return e ? `${e.code}  ${e.designation}` : '';
  };

  return (
    <div className="page two-col-wide">
      <section className="card panel">
        <header className="panel-head">
          <h3>Manuels, schémas et modèles 3D</h3>
          <div className="filters">
            <select className="filter-select" value={filters.typeDocument}
              onChange={(e) => setFilters({ ...filters, typeDocument: e.target.value })}>
              <option value="">Tous les types</option>
              {TYPES_DOCUMENT.map((t) => <option key={t} value={t}>{TYPE_DOC_LABELS[t]}</option>)}
            </select>
            <select className="filter-select" value={filters.equipementId}
              onChange={(e) => setFilters({ ...filters, equipementId: e.target.value })}>
              <option value="">Tous les équipements</option>
              {equipements.map((e) => <option key={e.id} value={e.id}>{e.code}</option>)}
            </select>
          </div>
        </header>

        {feedback?.error && <p className="login-error">{feedback.error}</p>}
        {feedback?.ok && <p className="form-ok">{feedback.ok}</p>}

        <table className="table">
          <thead>
            <tr><th>Fichier</th><th>Type</th><th>Équipement</th><th>Taille</th><th>Ajouté le</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.nomFichier}</strong>
                  {d.description && <><br /><span className="muted">{d.description}</span></>}
                </td>
                <td><span className="badge">{TYPE_DOC_LABELS[d.typeDocument] || d.typeDocument}</span></td>
                <td>{d.equipementId ? equipementLabel(d.equipementId) : ''}</td>
                <td>{fileSize(d.tailleOctets)}</td>
                <td className="muted">{timestamp(d.createdAt)}</td>
                <td>
                  <span className="row-tools">
                    <button className="step-check" onClick={() => download(d)}>Télécharger</button>
                    {isAdmin && <button className="step-check" onClick={() => remove(d)}>Supprimer</button>}
                  </span>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted">Aucun document.</td></tr>}
          </tbody>
        </table>
      </section>

      <aside className="card panel">
        <header className="panel-head"><h3>Téléverser un document</h3></header>
        {isAdmin ? (
          <form className="form-stack" onSubmit={submit}>
            <label>Fichier (50 Mo maximum)
              <input type="file" ref={fileRef} required />
            </label>
            <label>Type
              <select value={upload.typeDocument}
                onChange={(e) => setUpload({ ...upload, typeDocument: e.target.value })}>
                {TYPES_DOCUMENT.map((t) => <option key={t} value={t}>{TYPE_DOC_LABELS[t]}</option>)}
              </select>
            </label>
            <label>Équipement rattaché
              <select value={upload.equipementId}
                onChange={(e) => setUpload({ ...upload, equipementId: e.target.value })}>
                <option value="">Aucun</option>
                {equipements.map((e) => <option key={e.id} value={e.id}>{e.code}  {e.designation}</option>)}
              </select>
            </label>
            <label>Description
              <textarea rows={3} value={upload.description}
                onChange={(e) => setUpload({ ...upload, description: e.target.value })} />
            </label>
            <button className="primary-btn" disabled={busy}>
              <Clip size={15} /> {busy ? 'Envoi…' : 'Téléverser'}
            </button>
          </form>
        ) : (
          <p className="muted">
            Le téléversement est réservé au groupe ADMIN. Vous pouvez consulter et télécharger
            l'ensemble des documents publiés.
          </p>
        )}
      </aside>
    </div>
  );
}
