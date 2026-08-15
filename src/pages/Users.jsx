import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import { Plus } from '../components/Icons.jsx';
import { GROUPES, GROUPE_LABELS, timestamp } from '../lib/format.js';

const EMPTY = { userName: '', email: '', password: '', groupe: 'DMAT' };

/** Comptes et habilitations — /api/users (réservé au groupe ADMIN). */
export default function Users() {
  const [list, setList] = useState([]);
  const [groupe, setGroupe] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = () => api.users(groupe || undefined).then(setList)
    .catch((e) => setFeedback({ error: e.message }));

  useEffect(load, [groupe]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => `${u.userName} ${u.email}`.toLowerCase().includes(q));
  }, [list, search]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setFeedback(null);
    try {
      await api.createUser(form);
      setForm(EMPTY);
      setFeedback({ ok: 'Compte créé.' });
      load();
    } catch (err) { setFeedback({ error: err.message }); }
    finally { setBusy(false); }
  };

  const toggleActive = async (u) => {
    try { await api.setUserActive(u.id, !u.isActive); load(); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  const changeGroupe = async (u, value) => {
    try { await api.setUserGroupe(u.id, value); load(); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  const deactivate = async (u) => {
    if (!window.confirm(`Désactiver le compte ${u.userName} ? L'historique est conservé.`)) return;
    try { await api.deleteUser(u.id); load(); }
    catch (err) { setFeedback({ error: err.message }); }
  };

  return (
    <div className="page two-col-wide">
      <section className="card panel">
        <header className="panel-head">
          <h3>Comptes et habilitations</h3>
          <div className="filters">
            <input placeholder="Rechercher un identifiant, un e-mail…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
            {['', ...GROUPES].map((g) => (
              <button key={g || 'all'} className={`chip${groupe === g ? ' chip-active' : ''}`}
                onClick={() => setGroupe(g)}>{g || 'Tous'}</button>
            ))}
          </div>
        </header>

        {feedback?.error && <p className="login-error">{feedback.error}</p>}
        {feedback?.ok && <p className="form-ok">{feedback.ok}</p>}

        <table className="table">
          <thead>
            <tr><th>Utilisateur</th><th>Groupe</th><th>État</th><th>Créé le</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="cell-user">
                    <Avatar name={u.userName} size={30} online={u.isActive} />
                    <span className="cell-user-body">
                      <strong>{u.userName}</strong>
                      <span className="muted">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td>
                  <select className="filter-select" value={u.groupe}
                    onChange={(e) => changeGroupe(u, e.target.value)}>
                    {GROUPES.map((g) => <option key={g} value={g}>{GROUPE_LABELS[g]}</option>)}
                  </select>
                </td>
                <td className={u.isActive ? 'kpi-atteint' : 'kpi-non_atteint'}>
                  {u.isActive ? 'Actif' : 'Désactivé'}
                </td>
                <td className="muted">{timestamp(u.createdAt)}</td>
                <td>
                  <span className="row-tools">
                    <button className="step-check" onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Désactiver' : 'Réactiver'}
                    </button>
                    {u.isActive && <button className="step-check" onClick={() => deactivate(u)}>Retirer</button>}
                  </span>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="muted">Aucun compte.</td></tr>}
          </tbody>
        </table>
      </section>

      <aside className="card panel">
        <header className="panel-head"><h3>Nouveau compte</h3></header>
        <form className="form-stack" onSubmit={submit}>
          <label>Identifiant
            <input required maxLength={50} value={form.userName}
              onChange={(e) => setForm({ ...form, userName: e.target.value })} />
          </label>
          <label>Adresse e-mail
            <input required type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>Mot de passe (8 caractères minimum, au moins un chiffre)
            <input required type="password" minLength={8} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <label>Groupe
            <select value={form.groupe} onChange={(e) => setForm({ ...form, groupe: e.target.value })}>
              {GROUPES.map((g) => <option key={g} value={g}>{GROUPE_LABELS[g]}</option>)}
            </select>
          </label>
          <button className="primary-btn" disabled={busy}>
            <Plus size={15} /> {busy ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
      </aside>
    </div>
  );
}
