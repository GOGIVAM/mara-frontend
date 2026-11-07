import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ChampFichier, Coche, RailProgression } from '../components/Animations.jsx';
import TitreGamme from '../components/TitreGamme.jsx';
import { SAFETY_CLASS, SAFETY_LABELS, timestamp } from '../lib/format.js';
import { ajouterEnvoi, compresserPhoto, garderPhoto, synchroniser } from '../lib/offline.js';

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
const nouvelId = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (
    (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16))));

/** Exécution guidée d'une visite d'essieu T17 : démonstration sans valeur technique. */
export default function Intervention() {
  const { user } = useAuth();
  const [gamme, setGamme] = useState(() => lire(CLE_GAMME));
  const [suivi, setSuivi] = useState(() => lire(CLE_SUIVI));
  const [erreur, setErreur] = useState('');
  const [numero, setNumero] = useState('');
  const [recentes, setRecentes] = useState([]);
  const [historique, setHistorique] = useState(null);

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

  useEffect(() => {
    if (suivi) return;
    api.visites().then((l) => setRecentes(l.slice(0, 5))).catch(() => {});
  }, [suivi]);

  useEffect(() => {
    if (!suivi?.essieu) { setHistorique(null); return; }
    api.visites({ numeroEssieu: suivi.essieu }).then(setHistorique).catch(() => setHistorique(null));
  }, [suivi?.essieu]);

  const etapes = useMemo(
    () => [...(gamme?.etapes || [])].sort((a, b) => a.ordreIndex - b.ordreIndex),
    [gamme],
  );

  if (erreur) return <div className="page"><p className="scan-error">{erreur}</p></div>;
  if (!gamme) return <div className="page"><p className="muted">Chargement de la gamme…</p></div>;

  return (
    <div className="page intervention">
      {gamme.statut !== 'VALIDEE' && (
        <p className="demo-banner">
          <strong>Gamme non validée.</strong> Déroulé type sans valeur technique, à valider par CAMRAIL
          avant tout usage réel.
        </p>
      )}

      {!suivi && (
        <motion.section className="card panel intervention-debut" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h2>Visite d'un essieu T17</h2>
          <p className="muted"><TitreGamme titre={gamme.titre} /> · version {gamme.version} · {etapes.length} étapes</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            setSuivi({ id: nouvelId(), essieu: numero.trim(), debut: new Date().toISOString(), index: 0, reponses: {} });
          }}>
            <label htmlFor="numero-essieu">Numéro de l'essieu</label>
            <input id="numero-essieu" required value={numero} autoComplete="off"
              placeholder="Exemple fictif : T17-0001"
              onChange={(e) => setNumero(e.target.value)} />
            <button className="primary-btn">Démarrer la visite</button>
          </form>
          {recentes.length > 0 && (
            <>
              <h3 className="visites-titre">Dernières visites enregistrées</h3>
              <ul className="visites-liste">
                {recentes.map((v) => (
                  <li key={v.id}>
                    <strong>{v.numeroEssieu}</strong>
                    <span className="muted">{timestamp(v.clotureAt)} · {v.signataire}</span>
                    <span className={`resultat resultat-${v.nombreEcarts ? 'ecart' : 'conforme'}`}>
                      {v.nombreEcarts ? `${v.nombreEcarts} écart(s)` : 'Sans écart'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.section>
      )}

      {suivi && !suivi.cloture && suivi.index < etapes.length && (
        <Execution key={etapes[suivi.index].id} etapes={etapes} suivi={suivi} setSuivi={setSuivi} historique={historique} />
      )}

      {suivi && (suivi.cloture || suivi.index >= etapes.length) && (
        <Bilan etapes={etapes} suivi={suivi} setSuivi={setSuivi} operateur={user?.userName} gamme={gamme} />
      )}
    </div>
  );
}

function Execution({ etapes, suivi, setSuivi, historique }) {
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
      sens: 1,
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
        <RailProgression faites={faites} total={etapes.length} sens={suivi.sens ?? 1} />
        <p className="muted">{faites} sur {etapes.length} étapes</p>
        {historique && (
          <p className="muted">
            {historique.length
              ? `${historique.length} visite(s) précédente(s), dernière le ${timestamp(historique[0].clotureAt)}`
              : 'Aucune visite précédente enregistrée'}
          </p>
        )}
        <ol className="suivi-etapes">
          {etapes.map((e, i) => {
            const r = suivi.reponses[e.id];
            const etat = i === suivi.index ? 'courante' : r ? r.resultat : 'attente';
            return (
              <li key={e.id} className={`suivi-${etat}`}>
                <span className="suivi-num">
                  {r && i !== suivi.index ? <Coche animee={i === suivi.index - 1 && (suivi.sens ?? 1) > 0} />
                    : String(e.ordreIndex).padStart(2, '0')}
                </span>
                <span>{e.description}</span>
              </li>
            );
          })}
        </ol>
      </aside>

      <motion.section className={`card panel etape-courante etape-${SAFETY_CLASS[etape.niveauSecurite] || 'vert'}`}
        initial={{ opacity: 0, x: 36 * (suivi.sens ?? 1) }} animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
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
        <ChampFichier id="photo-etape" libelle="Prendre ou choisir une photo" accept="image/*" capture="environment"
          onChange={async (e) => {
            const fichier = e.target.files?.[0];
            if (!fichier) return;
            try {
              await garderPhoto(`${suivi.id}:${etape.id}`, await compresserPhoto(fichier));
              setPhoto(fichier.name);
            } catch (err) { setMessage(err.message); }
          }} />
        {photo && <p className="muted">Photo sélectionnée : {photo}</p>}

        {message && (
          <motion.p key={message} className="scan-error" role="alert"
            animate={{ x: [0, -7, 7, -4, 4, 0] }} transition={{ duration: 0.32 }}>{message}</motion.p>
        )}

        <div className="etape-actions">
          <button className="chip" disabled={suivi.index === 0}
            onClick={() => setSuivi({ ...suivi, index: suivi.index - 1, sens: -1 })}>Étape précédente</button>
          <span className="etape-espace" />
          <button className="btn-ecart" onClick={() => enregistrer('ecart')}>Écart ou doute</button>
          <button className="btn-conforme" onClick={() => enregistrer('conforme')}>Étape conforme</button>
        </div>
      </motion.section>
    </div>
  );
}

function Bilan({ etapes, suivi, setSuivi, operateur, gamme }) {
  const [signature, setSignature] = useState(operateur || '');

  const cloturer = async () => {
    const cloture = new Date().toISOString();
    await ajouterEnvoi({
      id: suivi.id,
      numeroEssieu: suivi.essieu,
      gammeId: gamme.id,
      gammeVersion: gamme.version,
      debutAt: suivi.debut,
      clotureAt: cloture,
      signataire: signature.trim(),
      etapes: etapes.filter((e) => suivi.reponses[e.id]).map((e) => {
        const r = suivi.reponses[e.id];
        return {
          etapeId: e.id,
          ordre: e.ordreIndex,
          description: e.description,
          resultat: r.resultat,
          mesure: r.mesure || null,
          note: r.note || null,
          realiseeAt: r.heure,
          photo: Boolean(r.photo),
        };
      }),
    });
    setSuivi({ ...suivi, cloture, signataire: signature.trim() });
    synchroniser();
  };
  const ecarts = etapes.filter((e) => suivi.reponses[e.id]?.resultat === 'ecart');

  return (
    <motion.section className="card panel bilan" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h2>Compte rendu de l'essieu {suivi.essieu}</h2>
      {suivi.cloture && (
        <motion.div className="tampon" initial={{ opacity: 0, scale: 1.7, rotate: -18 }}
          animate={{ opacity: 1, scale: 1, rotate: -8 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}>Signé</motion.div>
      )}
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
              onClick={cloturer}>
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
    </motion.section>
  );
}
