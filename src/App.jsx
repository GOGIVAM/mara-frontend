import { Suspense, lazy } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TrainGif } from './components/Animations.jsx';
import Sidebar from './components/Sidebar.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Assistance from './pages/Assistance.jsx';
import Compte from './pages/Compte.jsx';
import Essieu from './pages/Essieu.jsx';
import Documents from './pages/Documents.jsx';
import Equipements from './pages/Equipements.jsx';
import Gammes from './pages/Gammes.jsx';
import Intervention from './pages/Intervention.jsx';
import Journal from './pages/Journal.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Scan from './pages/Scan.jsx';
import Users from './pages/Users.jsx';

const Modele = lazy(() => import('./pages/Modele.jsx'));

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      {loading && (
        <div className="boot" role="status">
          <TrainGif />
          Chargement de la console
        </div>
      )}
      {!loading && !user && <Login />}
      {!loading && user && (
        <div className="app">
          <Sidebar />
          <main className="app-body">
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
                <Routes location={location}>
                  <Route path="/" element={<Overview />} />
                  <Route path="/intervention" element={<Intervention />} />
                  <Route path="/modele" element={<Suspense fallback={<p className="muted">Chargement de la maquette…</p>}><Modele /></Suspense>} />
                  <Route path="/assistance" element={<Assistance />} />
                  <Route path="/compte" element={<Compte />} />
                  <Route path="/essieux/:numero" element={<Essieu />} />
                  <Route path="/scan" element={<Scan />} />
                  <Route path="/equipements" element={<Equipements />} />
                  <Route path="/gammes" element={<Gammes />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/journal" element={isAdmin ? <Journal /> : <Navigate to="/" replace />} />
                  <Route path="/utilisateurs" element={isAdmin ? <Users /> : <Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      )}
    </MotionConfig>
  );
}
