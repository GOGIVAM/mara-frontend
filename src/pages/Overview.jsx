import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Chart, Cube, Offline, Signal, Wrench } from '../components/Icons.jsx';
import { GROUPE_LABELS, classLabel, percent } from '../lib/format.js';

/** Tableau de bord : GET /api/kpi/dashboard (ADMIN) + volumétrie du référentiel. */
export default function Overview() {
  const { isAdmin } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [ref, setRef] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    api.dashboard(days).then((d) => { setData(d); setError(''); })
      .catch((e) => { setData(null); setError(e.message); });
  }, [days, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    Promise.all([api.equipements(), api.gammes(), api.documents()])
      .then(([e, g, d]) => setRef({ totalEquipements: e.length, totalGammes: g.length, totalDocuments: d.length }))
      .catch((e) => setError(e.message));
  }, [isAdmin]);

  const referentiel = data?.referentiel || ref || {};
  const usage = data?.usageQuotidien || [];
  const maxUsage = Math.max(1, ...usage.map((u) => u.count));

  const tiles = [
    { key: 'equipements', value: referentiel.totalEquipements, label: 'Équipements référencés', Icon: Cube, tint: '#FDECEA', color: '#E10600' },
    { key: 'gammes', value: referentiel.totalGammes, label: 'Gammes actives', Icon: Wrench, tint: '#F1F0F0', color: '#4A4A4D' },
    { key: 'documents', value: referentiel.totalDocuments, label: 'Documents publiés', Icon: Chart, tint: '#F1F0F0', color: '#4A4A4D' },
    { key: 'interventions', value: data?.totalInterventions, label: `Reconnaissances sur ${days} j`, Icon: Signal, tint: '#FDECEA', color: '#E10600' },
    { key: 'score', value: data ? percent(data.avgScoreConfiance) : undefined, label: 'Score de confiance moyen', Icon: Chart, tint: '#F1F0F0', color: '#4A4A4D' },
    { key: 'fallback', value: data ? percent(data.fallbackQrRate) : undefined, label: 'Taux de repli marqueur QR', Icon: Offline, tint: '#FDECEA', color: '#E10600' },
  ];

  return (
    <div className="page">
      <div className="tiles">
        {tiles.map(({ key, value, label, Icon, tint, color }) => (
          <div key={key} className="card tile">
            <span className="action-icon" style={{ background: tint, color }}><Icon size={16} /></span>
            <span className="tile-value">{value ?? '—'}</span>
            <span className="tile-label">{label}</span>
          </div>
        ))}
      </div>

      {!isAdmin && (
        <p className="muted">
          Les indicateurs d'usage détaillés sont réservés au groupe ADMIN. Votre accès couvre le
          référentiel, les gammes, les documents et la reconnaissance d'équipement.
        </p>
      )}
      {error && isAdmin && <p className="login-error">{error}</p>}

      {data && (
        <>
          <div className="two-col">
            <section className="card panel">
              <header className="panel-head">
                <h3>Reconnaissances par jour</h3>
                <div className="filters">
                  {[7, 30, 90].map((d) => (
                    <button key={d} className={`chip${days === d ? ' chip-active' : ''}`}
                      onClick={() => setDays(d)}>{d} jours</button>
                  ))}
                </div>
              </header>
              {usage.length ? (
                <div className="bars">
                  {usage.map((u) => (
                    <div key={u.date} className="bar" title={`${u.date} — ${u.count} reconnaissance(s)`}>
                      <span style={{ height: `${(u.count / maxUsage) * 100}%` }} />
                      <small>{String(u.date).slice(5)}</small>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">Aucune reconnaissance journalisée sur la période.</p>}
            </section>

            <section className="card panel">
              <header className="panel-head"><h3>Usage par groupe</h3></header>
              <ul className="kpi-list">
                {(data.byGroupe || []).map((g) => (
                  <li key={g.groupe}>
                    <span className="kpi-label">{GROUPE_LABELS[g.groupe] || g.groupe || 'Non renseigné'}</span>
                    <span className="kpi-value">{g.count}</span>
                  </li>
                ))}
                {!(data.byGroupe || []).length && <li className="muted">Aucune donnée.</li>}
              </ul>
            </section>
          </div>

          <section className="card panel">
            <header className="panel-head">
              <h3>Classes détectées</h3>
              <span className="muted">Repli marqueur QR recommandé lorsque le score est insuffisant</span>
            </header>
            <table className="table">
              <thead>
                <tr><th>Classe</th><th>Détections</th><th>Repli QR</th><th>Part du repli</th></tr>
              </thead>
              <tbody>
                {(data.byClasse || []).map((c) => (
                  <tr key={c.classe}>
                    <td>{classLabel(c.classe)}</td>
                    <td>{c.count}</td>
                    <td>{c.fallbackCount}</td>
                    <td>
                      <div className="progress">
                        <span style={{ width: `${(c.fallbackCount / (c.count || 1)) * 100}%` }} />
                      </div>
                      <span className="muted">{percent(c.fallbackCount / (c.count || 1))}</span>
                    </td>
                  </tr>
                ))}
                {!(data.byClasse || []).length && (
                  <tr><td colSpan={4} className="muted">Aucune classe détectée sur la période.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
