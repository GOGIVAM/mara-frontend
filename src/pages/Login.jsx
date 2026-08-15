import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/Icons.jsx';

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
    <div className="login">
      <div className="login-shell">
        <form className="login-card" onSubmit={submit}>
          <div className="login-brand">
            <Logo height={54} className="" />
          </div>

          <h1>Console de maintenance augmentée</h1>
          <p className="login-tagline">Reconnaissance d'équipement, gammes de maintenance et documentation technique</p>

          <label>Identifiant
            <input value={userName} onChange={(e) => setUserName(e.target.value)}
              placeholder="ex. tech.dmat" autoComplete="username" required />
          </label>
          <label>Mot de passe
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe" type="password" autoComplete="current-password" required />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="primary-btn" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>

          <p className="login-help">
            Identifiants oubliés ? <strong>Contactez la Coordination Informatique</strong>
          </p>

          <div className="login-sep"><span>directions habilitées</span></div>

          <ul className="login-groupes">
            <li>DMAT</li><li>DIF</li><li>CI</li><li>CIF</li>
          </ul>
        </form>

        <p className="login-legal">
          L'accès à la console MA-RA est réservé au personnel habilité de CAMRAIL. Les connexions et
          les actions sont journalisées ; cinq échecs consécutifs verrouillent le compte pendant
          quinze minutes.
        </p>
      </div>
    </div>
  );
}
