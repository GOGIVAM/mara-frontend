import { Navigate, Route, Routes } from 'react-router-dom';
import TopBar from './components/TopBar.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Documents from './pages/Documents.jsx';
import Equipements from './pages/Equipements.jsx';
import Gammes from './pages/Gammes.jsx';
import Intervention from './pages/Intervention.jsx';
import Journal from './pages/Journal.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Scan from './pages/Scan.jsx';
import Users from './pages/Users.jsx';

export default function App() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="boot">Chargement de la console MA-RA…</div>;
  if (!user) return <Login />;

  return (
    <div className="app">
      <TopBar />
      <main className="app-body">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/intervention" element={<Intervention />} />
          <Route path="/equipements" element={<Equipements />} />
          <Route path="/gammes" element={<Gammes />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/journal" element={isAdmin ? <Journal /> : <Navigate to="/" replace />} />
          <Route path="/utilisateurs" element={isAdmin ? <Users /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
