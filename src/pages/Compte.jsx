import { useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { GROUPE_LABELS } from '../lib/format.js';
import { ecrireReglages, lectureDisponible, lire, lireReglages, signal } from '../lib/son.js';
import { voixDisponible } from '../lib/voix.js';
import { chiffrementDisponible } from '../lib/offline.js';

/** Mon compte : mot de passe, signaux sonores, lecture des consignes et commande vocale. */
export default function Compte() {
  const { user } = useAuth();
  const [reglages, setReglages] = useState(lireReglages);
  const [form, setForm] = useState({ ancien: '', nouveau: '', confirmation: '' });
  const [retour, setRetour] = useState(null);

  const basculer = (cle) => {
    const r = { ...reglages, [cle]: !reglages[cle] };
    setReglages(r);
    ecrireReglages(r);
    if (cle === 'signaux' && r.signaux) signal('validation');
    if (cle === 'lecture' && r.lecture) lire('Lecture des consignes activée.', true);
  };

  const changer = async (e) => {
    e.preventDefault();
    setRetour(null);
    if (form.nouveau !== form.confirmation) { setRetour({ erreur: 'Les deux saisies du nouveau mot de passe diffèrent.' }); return; }
    try {
      await api.changerMotDePasse(form.ancien, form.nouveau);
      setForm({ ancien: '', nouveau: '', confirmation: '' });
      setRetour({ ok: 'Mot de passe modifié.' });
    } catch (err) { setRetour({ erreur: err.message }); }
  };

  return (
    <div className="page two-col-wide compte">
      <section className="card panel">
        <header className="panel-head"><h3>Son et voix</h3></header>
        <div className="form-stack">
          <label className="case">
            <input type="checkbox" checked={reglages.signaux} onChange={() => basculer('signaux')} />
            Signaux sonores : validation, vigilance, alerte
          </label>
          <label className="case">
            <input type="checkbox" checked={reglages.lecture} disabled={!lectureDisponible()} onChange={() => basculer('lecture')} />
            Lire à voix haute chaque étape et chaque consigne
          </label>
          {!lectureDisponible() && <p className="muted">La lecture à voix haute n'est pas disponible sur ce navigateur.</p>}
          <label className="case">
            <input type="checkbox" checked={reglages.voix} disabled={!voixDisponible()} onChange={() => basculer('voix')} />
            Commande vocale
          </label>
          <p className="muted">
            {voixDisponible()
              ? "La reconnaissance de la parole du navigateur envoie le son au service de Google. Commandes : « conforme », « écart », « étape précédente », « répéter » pendant une visite ; « étape suivante », « annuler », « plan », « trois D », « caméra », « vue de face » sur la maquette."
              : "La commande vocale n'est pas disponible sur ce navigateur. Sur le casque RealWear, la commande vocale de l'appareil est à essayer."}
          </p>
          <div className="fiche-actions">
            <button type="button" className="chip" onClick={() => signal('validation')}>Essai validation</button>
            <button type="button" className="chip" onClick={() => signal('vigilance')}>Essai vigilance</button>
            <button type="button" className="chip" onClick={() => signal('alerte')}>Essai alerte</button>
          </div>
        </div>
      </section>

      <aside className="card panel">
        <header className="panel-head"><h3>Mon compte</h3></header>
        <p><strong>{user?.userName}</strong> · {GROUPE_LABELS[user?.groupe] || user?.groupe}</p>
        <p className="muted">
          {chiffrementDisponible()
            ? 'Visites et photos gardées sur ce terminal : chiffrées (AES-GCM, clé non exportable).'
            : 'Visites et photos gardées sur ce terminal : en clair, car la page n’est pas servie en HTTPS.'}
        </p>
        <form className="form-stack" onSubmit={changer}>
          <label>Mot de passe actuel
            <input type="password" required autoComplete="current-password" value={form.ancien}
              onChange={(e) => setForm({ ...form, ancien: e.target.value })} />
          </label>
          <label>Nouveau mot de passe (8 caractères au moins, dont un chiffre)
            <input type="password" required minLength={8} autoComplete="new-password" value={form.nouveau}
              onChange={(e) => setForm({ ...form, nouveau: e.target.value })} />
          </label>
          <label>Confirmer le nouveau mot de passe
            <input type="password" required minLength={8} autoComplete="new-password" value={form.confirmation}
              onChange={(e) => setForm({ ...form, confirmation: e.target.value })} />
          </label>
          <button className="primary-btn">Changer le mot de passe</button>
          {retour?.erreur && <p className="login-error" role="alert">{retour.erreur}</p>}
          {retour?.ok && <p className="form-ok" role="status">{retour.ok}</p>}
        </form>
      </aside>
    </div>
  );
}
