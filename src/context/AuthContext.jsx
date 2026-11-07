import { createContext, useContext, useEffect, useState } from 'react';
import api, { clearTokens, getToken, setTokens } from '../api/client.js';

const AuthContext = createContext(null);
const CLE_PROFIL = 'mara.profil';
const garderProfil = (p) => localStorage.setItem(CLE_PROFIL, JSON.stringify(p));
const lireProfil = () => {
  try { return JSON.parse(localStorage.getItem(CLE_PROFIL)); } catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me()
      .then((profil) => { garderProfil(profil); setUser(profil); })
      .catch((e) => {
        // Sans réseau, le terminal reste utilisable avec le dernier profil connu.
        const connu = lireProfil();
        if (e instanceof TypeError && connu) setUser(connu);
        else clearTokens();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (userName, password) => {
    const auth = await api.login(userName, password);
    setTokens(auth.accessToken, auth.refreshToken);
    const profile = await api.me();
    garderProfil(profile);
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* session déjà close */ }
    clearTokens();
    localStorage.removeItem(CLE_PROFIL);
    setUser(null);
  };

  // Le backend porte l'habilitation dans le claim « groupe ».
  const isAdmin = user?.groupe === 'ADMIN';
  const inGroupe = (...groupes) => isAdmin || groupes.includes(user?.groupe);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, inGroupe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
