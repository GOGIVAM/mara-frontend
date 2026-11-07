import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CONTENEUR, Compteur, ELEMENT, TrainGif } from '../components/Animations.jsx';
import { Chart, Cube, Summary, Wrench } from '../components/Icons.jsx';
import { GROUPE_LABELS, classLabel, percent, timestamp } from '../lib/format.js';

/** Tableau de bord : état du référentiel, visites signées et, s'il y en a, usage de la reconnaissance. */
export default function Overview() {
  const { isAdmin } = useAuth();
  const [days, setDays] = useState(30);
  const [usageIa, setUsageIa] = useState(null);
  const [ref, setRef] = useState(null);
  const [visites, setVisites] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.equipements(), api.gammes()])
      .then(([e, g]) => setRef({ equipements: e.length, gammes: g.length, validees: g.filter((x) => x.statut === 'VALIDEE').length }))
      .catch((e) => setError(e.message));
    api.visites().then(setVisites).catch((e) => { setVisites([]); setError(e.message); });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.dashboard(days).then(setUsageIa).catch(() => setUsageIa(null));
  }, [days, isAdmin]);

  const usage = usageIa?.usageQuotidien || [];
  const maxUsage = Math.max(1, ...usage.map((u) => u.count));
  const avecEcart = visites?.filter((v) => v.nombreEcarts > 0).length;
  const tuiles = [
    { cle: 'equipements', valeur: ref?.equipements, libelle: 'Équipements référencés', Icone: Cube },
    { cle: 'validees', valeur: ref?.validees, libelle: ref ? `Gammes validées sur ${ref.gammes}` : 'Gammes validées', Icone: Summary },
    { cle: 'visites', valeur: visites?.length, libelle: 'Visites signées récentes', Icone: Wrench },
    { cle: 'ecarts', valeur: avecEcart, libelle: 'Visites avec écart', Icone: Chart, alerte: avecEcart > 0 },
  ];

  return (
    <div className="page">
      <motion.section className="card accueil" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2>Visite d'un essieu T17</h2>
          <p>Suivez la gamme étape par étape, confirmez les mesures, signalez les écarts et signez le compte rendu, avec ou sans réseau.</p>
          <div className="accueil-actions">
            <Link className="primary-btn" to="/intervention">Démarrer une visite</Link>
          </div>
        </div>
        <TrainGif className="accueil-train" />
      </motion.section>

      {error && <p className="login-error" role="alert">{error}</p>}

      <motion.div className="tuiles" variants={CONTENEUR} initial="cache" animate="visible">
        {tuiles.map(({ cle, valeur, libelle, Icone, alerte }) => (
          <motion.div key={cle} variants={ELEMENT} className={`card tuile${alerte ? ' tuile-alerte' : ''}`}>
            <span className="tuile-icone"><Icone size={17} /></span>
            <span className="tuile-valeur"><Compteur valeur={valeur} /></span>
            <span className="tuile-libelle">{libelle}</span>
          </motion.div>
        ))}
      </motion.div>

      <section className="card panel">
        <header className="panel-head">
          <h3>Dernières visites</h3>
          <Link to="/intervention" className="lien-discret">Nouvelle visite</Link>
        </header>
        {visites?.length ? (
          <table className="table">
            <thead><tr><th>Essieu</th><th>Gamme</th><th>Clôture</th><th>Signataire</th><th>Résultat</th></tr></thead>
            <tbody>
              {visites.slice(0, 6).map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.numeroEssieu}</strong></td>
                  <td>{v.gammeCode} v{v.gammeVersion}</td>
                  <td className="muted">{timestamp(v.clotureAt)}</td>
                  <td>{v.signataire}</td>
                  <td><span className={`resultat resultat-${v.nombreEcarts ? 'ecart' : 'conforme'}`}>
                    {v.nombreEcarts ? `${v.nombreEcarts} écart(s)` : 'Sans écart'}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="vide">
            <TrainGif />
            <p>{visites ? 'Aucune visite signée pour le moment.' : 'Chargement…'}</p>
          </div>
        )}
      </section>

      {usageIa?.totalInterventions > 0 && (
        <div className="two-col">
          <section className="card panel">
            <header className="panel-head">
              <h3>Reconnaissances par jour</h3>
              <div className="filters">
                {[7, 30, 90].map((d) => (
                  <button key={d} className={`chip${days === d ? ' chip-active' : ''}`} onClick={() => setDays(d)}>{d} jours</button>
                ))}
              </div>
            </header>
            <div className="bars">
              {usage.map((u) => (
                <div key={u.date} className="bar" title={`${u.date} : ${u.count} reconnaissance(s)`}>
                  <motion.span initial={{ height: 0 }} animate={{ height: `${(u.count / maxUsage) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 22 }} />
                  <small>{String(u.date).slice(5)}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="card panel">
            <header className="panel-head"><h3>Usage</h3></header>
            <ul className="kpi-list">
              {(usageIa.byGroupe || []).map((g) => (
                <li key={g.groupe}>
                  <span className="kpi-label">{GROUPE_LABELS[g.groupe] || g.groupe || 'Non renseigné'}</span>
                  <span className="kpi-value">{g.count}</span>
                </li>
              ))}
              {(usageIa.byClasse || []).slice(0, 4).map((c) => (
                <li key={c.classe}>
                  <span className="kpi-label">{classLabel(c.classe)}</span>
                  <span className="kpi-value">{c.count} · repli {percent(c.fallbackCount / (c.count || 1))}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
