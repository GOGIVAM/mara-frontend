import { createContext, useContext, useEffect, useState } from 'react';
import api, { clearTokens, getToken, setTokens } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me().then(setUser).catch(() => clearTokens()).finally(() => setLoading(false));
  }, []);

  const login = async (userName, password) => {
    const auth = await api.login(userName, password);
    setTokens(auth.accessToken, auth.refreshToken);
    const profile = await api.me();
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* session déjà close */ }
    clearTokens();
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
