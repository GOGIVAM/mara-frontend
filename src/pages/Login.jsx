import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/Icons.jsx';

export default function Login() {
  const { login } = useAuth();
  const [userName, setUserName] = useState('admin');
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
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Logo height={42} className="" />
          <span className="brand-name">Maintenance <span>augmentée</span></span>
        </div>
        <h1>Connexion à la console</h1>
        <p className="muted">Directions DMAT, DIF, CI et CIF</p>

        <label>Identifiant
          <input value={userName} onChange={(e) => setUserName(e.target.value)}
            autoComplete="username" required />
        </label>
        <label>Mot de passe
          <input value={password} onChange={(e) => setPassword(e.target.value)}
            type="password" autoComplete="current-password" required />
        </label>

        {error && <p className="login-error">{error}</p>}
        <button className="primary-btn" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <p className="login-hint">
          Comptes de démonstration (seed backend) : admin · tech.dmat · chef.dmat · tech.dif ·
          chef.dif · coordinateur · formateur.
          <br />Cinq échecs consécutifs verrouillent le compte pendant 15 minutes.
        </p>
      </form>
    </div>
  );
}
