import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { GROUPE_LABELS } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import { Chart, Chat, Clip, Clock, Cube, Gear, Grid, Logo, Signal, Summary, Wrench } from './Icons.jsx';
import StatutReseau from './StatutReseau.jsx';

const NAV = [
  { to: '/', label: 'Tableau de bord', Icone: Grid, end: true },
  { to: '/intervention', label: 'Intervention', Icone: Wrench },
  { to: '/modele', label: 'Plan, 3D et RA', Icone: Cube },
  { to: '/assistance', label: 'Assistance', Icone: Chat },
  { to: '/scan', label: 'Reconnaissance', Icone: Signal },
  { to: '/equipements', label: 'Équipements', Icone: Gear },
  { to: '/gammes', label: 'Gammes', Icone: Summary },
  { to: '/documents', label: 'Documents', Icone: Clip },
];

const ADMIN_NAV = [
  { to: '/journal', label: 'Journal', Icone: Clock },
  { to: '/utilisateurs', label: 'Utilisateurs', Icone: Chart },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const [service, setService] = useState(null);

  useEffect(() => {
    const lire = () => api.inferenceHealth().then(setService).catch(() => setService({ available: false }));
    lire();
    const id = setInterval(lire, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-marque">
        <Logo height={24} />
        <span className="sidebar-nom">Maintenance <b>augmentée</b></span>
      </div>

      <nav className="side-nav" aria-label="Navigation principale">
        {(isAdmin ? [...NAV, ...ADMIN_NAV] : NAV).map(({ to, label, Icone, end }) => (
          <NavLink key={to} to={to} end={end} title={label} aria-label={label} className="side-lien">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span className="side-actif" layoutId="navigation-active"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <Icone size={18} />
                <span className="side-libelle">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-pied">
        <StatutReseau />
        {service && !service.available && (
          <span className="statut-reseau statut-hors-ligne" role="status"><Chart size={13} /> Reconnaissance indisponible</span>
        )}
        <div className="sidebar-compte">
          <Avatar name={user?.userName || 'MA RA'} size={32} online={user?.isActive} />
          <div className="sidebar-identite">
            <strong>{user?.userName}</strong>
            <span title={GROUPE_LABELS[user?.groupe] || ''}>{user?.groupe}</span>
          </div>
        </div>
        <button className="sidebar-sortie" onClick={logout}>Se déconnecter</button>
      </div>
    </aside>
  );
}
