import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { GROUPE_LABELS } from '../lib/format.js';
import { can } from '../t17/model.js';
import Avatar from './Avatar.jsx';
import { Bell, Gear, Logo } from './Icons.jsx';

const NAV = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/scan', label: 'Reconnaissance' },
  { to: '/equipements', label: 'Équipements' },
  { to: '/gammes', label: 'Gammes' },
  { to: '/documents', label: 'Documents' },
  { to: '/essieu-t17', label: 'Essieu T17', right: 'view' },
];

const ADMIN_NAV = [
  { to: '/journal', label: 'Journal' },
  { to: '/utilisateurs', label: 'Utilisateurs' },
];

export default function TopBar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);

  // État du service de reconnaissance (GET /api/inference/health), rafraîchi chaque minute.
  useEffect(() => {
    const load = () => api.inferenceHealth().then(setHealth).catch(() => setHealth({ available: false }));
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const nav = (isAdmin ? [...NAV, ...ADMIN_NAV] : NAV).filter((item) => !item.right || can(user?.groupe, item.right));

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <Logo height={26} />
          <span className="brand-rule" />
          <span className="brand-name">Maintenance <span>augmentée</span></span>
        </div>
        <span className="groupe-chip" title={GROUPE_LABELS[user?.groupe] || ''}>{user?.groupe}</span>
      </div>

      <nav className="pill-nav">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `pill${isActive ? ' pill-active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-right">
        {isAdmin && (
          <button className="icon-btn" title="Comptes et habilitations" onClick={() => navigate('/utilisateurs')}>
            <Gear size={19} />
          </button>
        )}
        <button
          className="icon-btn"
          title={health?.available ? 'Service de reconnaissance disponible' : 'Service de reconnaissance indisponible'}
          onClick={() => navigate('/scan')}
        >
          <Bell size={19} />
          {health && !health.available && <span className="notif-dot" />}
        </button>
        <button className="avatar-btn" title={`${user?.userName} : se déconnecter`} onClick={logout}>
          <Avatar name={user?.userName || 'MA RA'} size={34} online={user?.isActive} />
        </button>
      </div>
    </header>
  );
}
