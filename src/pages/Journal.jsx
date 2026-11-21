import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { CLASSES, classLabel, percent, timestamp } from '../lib/format.js';

/** Journal des interventions  GET /api/kpi/interventions (ADMIN, paginé). */
export default function Journal() {
  const [state, setState] = useState({ days: 7, classe: '', userId: '', page: 1, pageSize: 25 });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.interventions(state).then((d) => { setData(d); setError(''); })
      .catch((e) => { setData(null); setError(e.message); });
  }, [state.days, state.classe, state.userId, state.page, state.pageSize]);

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));

  return (
    <div className="page">
      <section className="card panel">
        <header className="panel-head">
          <h3>Journal des interventions</h3>
          <div className="filters">
            {[7, 30, 90].map((d) => (
              <button key={d} className={`chip${state.days === d ? ' chip-active' : ''}`}
                onClick={() => setState({ ...state, days: d, page: 1 })}>{d} jours</button>
            ))}
            <select className="filter-select" value={state.classe}
              onChange={(e) => setState({ ...state, classe: e.target.value, page: 1 })}>
              <option value="">Toutes les classes</option>
              {CLASSES.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
            </select>
            <input placeholder="Filtrer par identifiant utilisateur" value={state.userId}
              onChange={(e) => setState({ ...state, userId: e.target.value, page: 1 })} />
          </div>
        </header>

        {error && <p className="login-error">{error}</p>}

        <table className="table">
          <thead>
            <tr><th>Début</th><th>Groupe</th><th>Classe détectée</th><th>Confiance</th><th>Repli QR</th><th>Session</th><th>Fin</th></tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id}>
                <td className="muted">{timestamp(l.debutAt)}</td>
                <td>{l.userGroupe ? <span className="badge">{l.userGroupe}</span> : <span className="muted">–</span>}</td>
                <td>{l.classeDetectee ? classLabel(l.classeDetectee) : <span className="muted">–</span>}</td>
                <td>
                  <span className={`score${(l.scoreConfiance || 0) >= 0.7 ? ' score-ok' : ''}`}>
                    {l.scoreConfiance != null ? percent(l.scoreConfiance) : '–'}
                  </span>
                </td>
                <td>{l.fallbackQr ? 'Oui' : 'Non'}</td>
                <td className="muted">{l.sessionId || '–'}</td>
                <td className="muted">{l.finAt ? timestamp(l.finAt) : 'en cours'}</td>
              </tr>
            ))}
            {!items.length && !error && <tr><td colSpan={7} className="muted">Aucune intervention sur la période.</td></tr>}
          </tbody>
        </table>

        <footer className="pager">
          <span className="muted">{total} entrée(s) · page {state.page} / {pages}</span>
          <div className="filters">
            <button className="chip" disabled={state.page <= 1}
              onClick={() => setState({ ...state, page: state.page - 1 })}>Précédent</button>
            <button className="chip" disabled={state.page >= pages}
              onClick={() => setState({ ...state, page: state.page + 1 })}>Suivant</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
