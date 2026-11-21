import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import TopBar from './components/TopBar.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Documents from './pages/Documents.jsx';
import EssieuT17 from './pages/EssieuT17.jsx';
import Equipements from './pages/Equipements.jsx';
import Gammes from './pages/Gammes.jsx';
import Journal from './pages/Journal.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Scan from './pages/Scan.jsx';
import Users from './pages/Users.jsx';

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <div className="boot"><span className="spinner" />Chargement de la console MA-RA…</div>;
  if (!user) return <Login />;

  return (
    <div className="app">
      <TopBar />
      <main className="app-body">
        <div className="route" key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Overview />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/equipements" element={<Equipements />} />
          <Route path="/gammes" element={<Gammes />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/essieu-t17" element={<EssieuT17 />} />
          <Route path="/journal" element={isAdmin ? <Journal /> : <Navigate to="/" replace />} />
          <Route path="/utilisateurs" element={isAdmin ? <Users /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </main>
    </div>
  );
}
