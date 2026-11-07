import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext.jsx';
import { TrainGif } from '../components/Animations.jsx';
import { Logo } from '../components/Icons.jsx';

const GESTES = ['Identifier', 'Contrôler', 'Tracer', 'Signer'];

function Scene() {
  const reduit = useReducedMotion();
  const [geste, setGeste] = useState(0);

  useEffect(() => {
    if (reduit) return undefined;
    const id = setInterval(() => setGeste((g) => (g + 1) % GESTES.length), 2200);
    return () => clearInterval(id);
  }, [reduit]);

  return (
    <aside className="login-scene">
      <TrainGif variante="scene" className="login-fond" />
      <div aria-hidden="true">
        <p className="login-surtitre">MA-RA · CAMRAIL</p>
        <h2>Visite d'essieu et gammes de maintenance</h2>
      </div>
      <div className="login-geste" aria-hidden="true">
        <AnimatePresence mode="wait">
          <motion.span key={geste} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.35 }}>
            {GESTES[geste]}
          </motion.span>
        </AnimatePresence>
      </div>
      <p className="login-credit">
        Photo : Niranjan Arminius,{' '}
        <a href="https://commons.wikimedia.org/wiki/File:BTV_WaterfrontTrain_200608.gif" target="_blank" rel="noreferrer">Wikimedia Commons</a>,{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, recadrée.
      </p>
    </aside>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(userName, password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <Scene />
      <main className="login-colonne">
        <motion.form className="login-card" onSubmit={submit}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
          <div className="login-brand"><Logo height={48} className="" /></div>
          <h1>Console de maintenance</h1>
          <p className="login-tagline">Gammes guidées, assistance à distance et traçabilité des interventions</p>

          <label>Identifiant
            <input value={userName} onChange={(e) => setUserName(e.target.value)}
              placeholder="ex. tech.dmat" autoComplete="username" required />
          </label>
          <label>Mot de passe
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe" type="password" autoComplete="current-password" required />
          </label>

          {error && (
            <motion.p key={error} className="login-error" role="alert"
              animate={{ x: [0, -7, 7, -4, 4, 0] }} transition={{ duration: 0.35 }}>{error}</motion.p>
          )}

          <button className="primary-btn" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>

          <p className="login-help">
            Identifiants oubliés ? <strong>Contactez la Coordination Informatique</strong>
          </p>
        </motion.form>

        <p className="login-legal">
          Accès réservé au personnel habilité de CAMRAIL (DMAT, DIF, CI, CIF). Les connexions et les
          actions sont journalisées ; cinq échecs consécutifs verrouillent le compte pendant quinze minutes.
        </p>
      </main>
    </div>
  );
}
