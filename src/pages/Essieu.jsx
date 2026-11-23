import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { timestamp } from '../lib/format.js';

export const STATUTS_ESSIEU = {
  EN_SERVICE: { libelle: 'En service', classe: 'statut-actif' },
  BLOQUE: { libelle: "Bloqué : décision de l'expert attendue", classe: 'statut-bloque' },
  HORS_SERVICE: { libelle: 'Hors service', classe: 'statut-maintenance' },
  INCONNU: { libelle: 'Aucune visite', classe: '' },
};
const DECISIONS = {
  REMISE_EN_SERVICE: 'Remise en service',
  A_REPARER: 'À réparer',
  RETIRE_DU_SERVICE: 'Retiré du service',
};
const nombre = (v, d = 2) => (v === null || v === undefined ? '' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d }));
const jour = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Dossier d'un essieu : statut, décision de l'expert, visites, mesures et tendance d'usure. */
export default function Essieu() {
  const { numero } = useParams();
  const { inGroupe } = useAuth();
  const [dossier, setDossier] = useState(null);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ decision: 'REMISE_EN_SERVICE', motif: '' });
  const [retour, setRetour] = useState(null);
  const expert = inGroupe('CI', 'CIF');

  const charger = useCallback(() => api.dossierEssieu(numero).then(setDossier).catch((e) => setErreur(e.message)), [numero]);
  useEffect(() => { charger(); }, [charger]);

  if (erreur) return <div className="page"><p className="scan-error" role="alert">{erreur}</p></div>;
  if (!dossier) return <div className="page"><p className="muted">Chargement du dossier…</p></div>;

  const statut = STATUTS_ESSIEU[dossier.statut] || STATUTS_ESSIEU.INCONNU;
  const aDecider = dossier.visites.find((v) => v.nombreEcarts > 0);

  const decider = async (e) => {
    e.preventDefault();
    setRetour(null);
    try {
      await api.deciderEssieu(numero, { visiteId: aDecider.id, decision: form.decision, motif: form.motif });
      setForm({ ...form, motif: '' });
      setRetour({ ok: 'Décision enregistrée.' });
      charger();
    } catch (err) { setRetour({ erreur: err.message }); }
  };

  return (
    <div className="page essieu">
      <header className="modele-tete">
        <div>
          <h2>Essieu {dossier.numero}</h2>
          <p><span className={`badge ${statut.classe}`}>{statut.libelle}</span></p>
        </div>
        <Link className="chip" to="/intervention">Intervention</Link>
      </header>

      <div className="two-col-wide">
        <section className="card panel">
          <header className="panel-head"><h3>Mesures et usure</h3></header>
          {!dossier.series.length && <p className="muted">Aucune mesure numérique enregistrée pour cet essieu.</p>}
          {dossier.series.map((s) => <Serie key={s.etapeId} serie={s} />)}
        </section>

        <aside className="card panel">
          {aDecider && (dossier.statut === 'BLOQUE' || expert) && (
            <div className="decision">
              <h3>Décision de l'expert</h3>
              <p className="muted">Visite du {timestamp(aDecider.clotureAt)} : {aDecider.nombreEcarts} écart(s).</p>
              {expert ? (
                <form className="form-stack" onSubmit={decider}>
                  <label>Décision
                    <select value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}>
                      {Object.entries(DECISIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </label>
                  <label>Motif
                    <textarea rows={3} required minLength={5} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} />
                  </label>
                  <button className="primary-btn">Enregistrer la décision</button>
                </form>
              ) : <p className="muted">La décision revient à un expert habilité (groupes CI, CIF ou administrateur).</p>}
              {retour?.erreur && <p className="login-error" role="alert">{retour.erreur}</p>}
              {retour?.ok && <p className="form-ok" role="status">{retour.ok}</p>}
            </div>
          )}

          <h3>Décisions</h3>
          {!dossier.decisions.length && <p className="muted">Aucune décision enregistrée.</p>}
          <ul className="visites-liste">
            {dossier.decisions.map((d) => (
              <li key={d.id}>
                <strong>{DECISIONS[d.decision] || d.decision}</strong>
                <span className="muted">{timestamp(d.decideAt)} · {d.decideur}</span>
                <span>{d.motif}</span>
              </li>
            ))}
          </ul>

          <h3>Visites</h3>
          <ul className="visites-liste">
            {dossier.visites.map((v) => (
              <li key={v.id}>
                <strong>{timestamp(v.clotureAt)}</strong>
                <span className="muted">{v.gammeCode} v{v.gammeVersion} · {v.signataire}{v.versionConforme ? '' : ' · version de gamme différente à la réception'}</span>
                <span className={`resultat resultat-${v.nombreEcarts ? 'ecart' : 'conforme'}`}>
                  {v.nombreEcarts ? `${v.nombreEcarts} écart(s)` : 'Sans écart'}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/** Courbe d'une mesure : points relevés, limites validées, tendance linéaire. */
function Serie({ serie }) {
  const { points, limiteMin, limiteMax, unite, estimation: e } = serie;
  const L = 520;
  const H = 170;
  const m = { g: 44, d: 12, h: 12, b: 26 };
  const dates = points.map((p) => new Date(p.date).getTime());
  const valeurs = points.map((p) => Number(p.valeur));
  const bornes = [...valeurs, limiteMin, limiteMax].filter((v) => v !== null && v !== undefined).map(Number);
  let yMin = Math.min(...bornes);
  let yMax = Math.max(...bornes);
  if (yMax - yMin < 1e-9) { yMin -= 1; yMax += 1; }
  const marge = (yMax - yMin) * 0.12;
  yMin -= marge; yMax += marge;
  const t0 = Math.min(...dates);
  let t1 = Math.max(...dates, e.dateLimiteEstimee ? new Date(e.dateLimiteEstimee).getTime() : 0);
  if (t1 - t0 < 1) t1 = t0 + 86400000;
  const x = (t) => m.g + ((t - t0) / (t1 - t0)) * (L - m.g - m.d);
  const y = (v) => m.h + (1 - (v - yMin) / (yMax - yMin)) * (H - m.h - m.b);
  const u = unite ? ` ${unite}` : '';
  const pente = e.penteParAn !== null && e.penteParAn !== undefined ? Number(e.penteParAn) / 365.25 / 86400000 : null;

  return (
    <div className="serie">
      <h4>{String(serie.ordre).padStart(2, '0')} · {serie.description}</h4>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Mesures de ${serie.description}`}>
        {[limiteMin, limiteMax].map((lim, i) => (lim === null || lim === undefined ? null : (
          <g key={i}>
            <line x1={m.g} x2={L - m.d} y1={y(lim)} y2={y(lim)} className="serie-limite" />
            <text x={m.g + 4} y={i ? y(lim) - 4 : y(lim) + 12} className="serie-texte serie-texte-limite">{i ? 'max' : 'min'} {nombre(lim)}{u}</text>
          </g>
        )))}
        {pente !== null && points.length > 1 && (
          <line className="serie-tendance" x1={x(t0)} x2={x(t1)}
            y1={y(valeurs.reduce((a, b) => a + b, 0) / valeurs.length + pente * (t0 - dates.reduce((a, b) => a + b, 0) / dates.length))}
            y2={y(valeurs.reduce((a, b) => a + b, 0) / valeurs.length + pente * (t1 - dates.reduce((a, b) => a + b, 0) / dates.length))} />
        )}
        <polyline className="serie-ligne" points={points.map((p, i) => `${x(dates[i])},${y(valeurs[i])}`).join(' ')} />
        {points.map((p, i) => <circle key={p.date} cx={x(dates[i])} cy={y(valeurs[i])} r="4" className="serie-point"><title>{jour(p.date)} : {nombre(p.valeur)}{u}</title></circle>)}
        <text x={m.g - 6} y={y(yMax - marge) + 4} textAnchor="end" className="serie-texte">{nombre(yMax - marge)}</text>
        <text x={m.g - 6} y={y(yMin + marge) + 4} textAnchor="end" className="serie-texte">{nombre(yMin + marge)}</text>
        <text x={m.g} y={H - 6} className="serie-texte">{jour(t0)}</text>
        <text x={L - m.d} y={H - 6} textAnchor="end" className="serie-texte">{jour(t1)}</text>
      </svg>
      <p className="muted">
        Dernière valeur : <strong>{nombre(e.derniere)}{u}</strong> · {e.nombrePoints} relevé(s)
        {serie.horsLimites > 0 && <span className="resultat resultat-ecart"> · {serie.horsLimites} hors limites</span>}
      </p>
      <p className="muted">
        {limiteMin === null && limiteMax === null
          ? 'Limites non renseignées dans la gamme : la marge restante sera calculée dès que la gamme CAMRAIL les fournira.'
          : e.depassee
            ? `Dernière mesure déjà ${e.limiteVisee === 'min' ? 'sous la limite minimale' : 'au-dessus de la limite maximale'} : l'essieu ne doit pas être remis en service sans décision.${e.penteParAn !== null ? ` Tendance : ${nombre(e.penteParAn, 3)}${u} par an.` : ''}`
          : e.penteParAn === null
            ? 'Deux relevés au moins sont nécessaires pour estimer la tendance.'
            : e.joursAvantLimite === null
              ? `Tendance : ${nombre(e.penteParAn, 3)}${u} par an, qui ne se dirige vers aucune limite.`
              : `Tendance : ${nombre(e.penteParAn, 3)}${u} par an. Limite ${e.limiteVisee === 'min' ? 'minimale' : 'maximale'} atteinte dans environ ${e.joursAvantLimite} jours, vers le ${jour(e.dateLimiteEstimee)}. Estimation linéaire sur ${e.nombrePoints} relevés, à confirmer par la mesure.`}
      </p>
    </div>
  );
}
