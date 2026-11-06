import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import TitreGamme from '../components/TitreGamme.jsx';
import { SAFETY_CLASS, SAFETY_LABELS, timestamp } from '../lib/format.js';

const CODE_GAMME = 'GESS-T17-DEMO';
const CLE_GAMME = 'mara.demo.t17.gamme';
const CLE_SUIVI = 'mara.demo.t17.suivi';

const lire = (cle) => {
  try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; }
};
const ecrire = (cle, valeur) => {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify(valeur));
  } catch { /* stockage indisponible : l'écran reste utilisable */ }
};
const estMesure = (etape) => /^Mesurer/i.test(etape.description);

/** Exécution guidée d'une visite d'essieu T17 : démonstration sans valeur technique. */
export default function Intervention() {
  const { user } = useAuth();
  const [gamme, setGamme] = useState(() => lire(CLE_GAMME));
  const [suivi, setSuivi] = useState(() => lire(CLE_SUIVI));
  const [erreur, setErreur] = useState('');
  const [numero, setNumero] = useState('');

  useEffect(() => {
    api.gammes()
      .then((liste) => {
        const trouvee = liste.find((g) => g.code === CODE_GAMME);
        if (!trouvee) throw new Error("La gamme de démonstration de l'essieu T17 est absente.");
        return api.gamme(trouvee.id);
      })
      .then((g) => { setGamme(g); ecrire(CLE_GAMME, g); setErreur(''); })
      .catch((e) => { if (!lire(CLE_GAMME)) setErreur(e.message); });
  }, []);

  useEffect(() => { ecrire(CLE_SUIVI, suivi); }, [suivi]);

  const etapes = useMemo(
    () => [...(gamme?.etapes || [])].sort((a, b) => a.ordreIndex - b.ordreIndex),
    [gamme],
  );

  if (erreur) return <div className="page"><p className="scan-error">{erreur}</p></div>;
  if (!gamme) return <div className="page"><p className="muted">Chargement de la gamme…</p></div>;

  return (
    <div className="page intervention">
      <p className="demo-banner">
        <strong>Démonstration.</strong> Déroulé type sans valeur technique. Les cotes seront celles de
        la gamme validée par CAMRAIL. Les données restent sur cet appareil.
      </p>

      {!suivi && (
        <section className="card panel intervention-debut">
          <h2>Visite d'un essieu T17</h2>
          <p className="muted"><TitreGamme titre={gamme.titre} /> · version {gamme.version} · {etapes.length} étapes</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            setSuivi({ essieu: numero.trim(), debut: new Date().toISOString(), index: 0, reponses: {} });
          }}>
            <label htmlFor="numero-essieu">Numéro de l'essieu</label>
            <input id="numero-essieu" required value={numero} autoComplete="off"
              placeholder="Exemple fictif : T17-0001"
              onChange={(e) => setNumero(e.target.value)} />
            <button className="primary-btn">Démarrer la visite</button>
          </form>
        </section>
      )}

      {suivi && !suivi.cloture && suivi.index < etapes.length && (
        <Execution key={etapes[suivi.index].id} etapes={etapes} suivi={suivi} setSuivi={setSuivi} />
      )}

      {suivi && (suivi.cloture || suivi.index >= etapes.length) && (
        <Bilan etapes={etapes} suivi={suivi} setSuivi={setSuivi} operateur={user?.userName} />
      )}
    </div>
  );
}

function Execution({ etapes, suivi, setSuivi }) {
  const etape = etapes[suivi.index];
  const existante = suivi.reponses[etape.id] || {};
  const [note, setNote] = useState(existante.note || '');
  const [mesure, setMesure] = useState(existante.mesure || '');
  const [confirmation, setConfirmation] = useState(existante.mesure || '');
  const [photo, setPhoto] = useState(existante.photo || '');
  const [securite, setSecurite] = useState(false);
  const [message, setMessage] = useState('');

  const rouge = etape.niveauSecurite === 'ROUGE';
  const mesureRequise = estMesure(etape);
  const faites = Object.keys(suivi.reponses).length;

  const enregistrer = (resultat) => {
    if (rouge && !securite) { setMessage('Confirmez la consigne de sécurité avant de continuer.'); return; }
    if (mesureRequise && resultat === 'conforme') {
      if (!mesure.trim()) { setMessage('Saisissez la valeur mesurée.'); return; }
      if (mesure.trim() !== confirmation.trim()) {
        setMessage('Les deux saisies diffèrent. Mesurez de nouveau.'); return;
      }
    }
    if (resultat === 'ecart' && !note.trim()) { setMessage("Décrivez l'écart constaté."); return; }
    setSuivi({
      ...suivi,
      index: suivi.index + 1,
      reponses: {
        ...suivi.reponses,
        [etape.id]: { resultat, note: note.trim(), mesure: mesure.trim(), photo, heure: new Date().toISOString() },
      },
    });
  };

  return (
    <div className="intervention-grille">
      <aside className="card panel">
        <h3 className="intervention-essieu">Essieu {suivi.essieu}</h3>
        <div className="progression" role="progressbar" aria-label="Avancement de la visite"
          aria-valuemin={0} aria-valuemax={etapes.length} aria-valuenow={faites}>
          <span style={{ width: `${(faites / etapes.length) * 100}%` }} />
        </div>
        <p className="muted">{faites} sur {etapes.length} étapes</p>
        <ol className="suivi-etapes">
          {etapes.map((e, i) => {
            const r = suivi.reponses[e.id];
            const etat = i === suivi.index ? 'courante' : r ? r.resultat : 'attente';
            return (
              <li key={e.id} className={`suivi-${etat}`}>
                <span className="suivi-num">{String(e.ordreIndex).padStart(2, '0')}</span>
                <span>{e.description}</span>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className={`card panel etape-courante etape-${SAFETY_CLASS[etape.niveauSecurite] || 'vert'}`}>
        <div className="etape-tete">
          <span className="muted">Étape {suivi.index + 1} sur {etapes.length}</span>
          <span className={`niveau niveau-${SAFETY_CLASS[etape.niveauSecurite] || 'vert'}`}>
            {SAFETY_LABELS[etape.niveauSecurite] || 'Standard'}
          </span>
        </div>
        <h2>{etape.description}</h2>

        {rouge && (
          <label className="confirmation-securite">
            <input type="checkbox" checked={securite} onChange={(e) => setSecurite(e.target.checked)} />
            Consigne de sécurité lue et appliquée
          </label>
        )}

        {mesureRequise && (
          <div className="mesure">
            <div>
              <label htmlFor="mesure-1">Valeur mesurée</label>
              <input id="mesure-1" inputMode="decimal" value={mesure} onChange={(e) => { setMesure(e.target.value); setMessage(''); }} />
            </div>
            <div>
              <label htmlFor="mesure-2">Confirmer la valeur</label>
              <input id="mesure-2" inputMode="decimal" value={confirmation}
                onChange={(e) => { setConfirmation(e.target.value); setMessage(''); }} />
            </div>
            <p className="muted">Limite non renseignée : la comparaison sera activée avec la gamme validée.</p>
          </div>
        )}

        <label htmlFor="note-etape">Observation</label>
        <textarea id="note-etape" rows={3} value={note} onChange={(e) => { setNote(e.target.value); setMessage(''); }}
          placeholder="Obligatoire en cas d'écart" />

        <label htmlFor="photo-etape">Photo (facultative)</label>
        <input id="photo-etape" type="file" accept="image/*" capture="environment"
          onChange={(e) => setPhoto(e.target.files?.[0]?.name || '')} />
        {photo && <p className="muted">Photo sélectionnée : {photo}</p>}

        {message && <p className="scan-error" role="alert">{message}</p>}

        <div className="etape-actions">
          <button className="chip" disabled={suivi.index === 0}
            onClick={() => setSuivi({ ...suivi, index: suivi.index - 1 })}>Étape précédente</button>
          <span className="etape-espace" />
          <button className="btn-ecart" onClick={() => enregistrer('ecart')}>Écart ou doute</button>
          <button className="btn-conforme" onClick={() => enregistrer('conforme')}>Étape conforme</button>
        </div>
      </section>
    </div>
  );
}

function Bilan({ etapes, suivi, setSuivi, operateur }) {
  const [signature, setSignature] = useState(operateur || '');
  const ecarts = etapes.filter((e) => suivi.reponses[e.id]?.resultat === 'ecart');

  return (
    <section className="card panel bilan">
      <h2>Compte rendu de l'essieu {suivi.essieu}</h2>
      <p className="muted">
        Début : {timestamp(suivi.debut)}
        {suivi.cloture && ` · Clôture : ${timestamp(suivi.cloture)} · Signé par ${suivi.signataire}`}
      </p>

      {ecarts.length > 0
        ? <p className="bilan-alerte" role="alert">
            {ecarts.length} écart{ecarts.length > 1 ? 's' : ''} : essieu à ne pas remettre en service sans décision de l'expert.
          </p>
        : <p className="bilan-ok">Aucun écart signalé. La décision de remise en service reste humaine.</p>}

      <table className="table">
        <thead><tr><th>N°</th><th>Étape</th><th>Résultat</th><th>Mesure</th><th>Observation</th><th>Heure</th></tr></thead>
        <tbody>
          {etapes.map((e) => {
            const r = suivi.reponses[e.id] || {};
            return (
              <tr key={e.id}>
                <td>{String(e.ordreIndex).padStart(2, '0')}</td>
                <td>{e.description}</td>
                <td><span className={`resultat resultat-${r.resultat || 'attente'}`}>
                  {r.resultat === 'ecart' ? 'Écart' : r.resultat === 'conforme' ? 'Conforme' : 'Non réalisé'}
                </span></td>
                <td>{r.mesure}</td>
                <td>{r.note}{r.photo ? ` (photo : ${r.photo})` : ''}</td>
                <td>{r.heure ? new Date(r.heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="bilan-actions">
        {!suivi.cloture ? (
          <>
            <button className="chip" onClick={() => setSuivi({ ...suivi, index: etapes.length - 1 })}>Revenir à la dernière étape</button>
            <span className="etape-espace" />
            <label htmlFor="signature">Signature de l'opérateur</label>
            <input id="signature" value={signature} onChange={(e) => setSignature(e.target.value)} />
            <button className="btn-conforme" disabled={!signature.trim()}
              onClick={() => setSuivi({ ...suivi, cloture: new Date().toISOString(), signataire: signature.trim() })}>
              Signer et clôturer
            </button>
          </>
        ) : (
          <>
            <button className="chip" onClick={() => window.print()}>Imprimer</button>
            <span className="etape-espace" />
            <button className="primary-btn" onClick={() => setSuivi(null)}>Nouvelle visite</button>
          </>
        )}
      </div>
    </section>
  );
}
