/**
 * Client HTTP MA-RA  aligné sur le backend .NET (MaRa.Api).
 * Routes réelles : /api/auth, /api/users, /api/equipements, /api/gammes,
 * /api/documents, /api/inference, /api/kpi.
 */
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'mara.token';
const REFRESH_KEY = 'mara.refresh';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const setTokens = (access, refresh) => {
  localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
};
export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

async function raw(path, { method = 'GET', body, form, headers = {}, retry = true } = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(form ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: form ? form : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && (await refreshSession())) {
    return raw(path, { method, body, form, headers, retry: false });
  }
  if (res.status === 401) {
    clearTokens();
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }
  if (res.status === 403) {
    const error = new Error("Accès refusé : votre groupe n'a pas ce droit.");
    error.forbidden = true;
    throw error;
  }
  if (res.status === 429) throw new Error('Trop de tentatives. Réessayez dans une minute.');
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload.message
      || (Array.isArray(payload.errors) ? payload.errors.join(' · ') : null)
      || payload.title
      || `Erreur ${res.status}`;
    throw new Error(message);
  }
  return res;
}

async function request(path, opts) {
  const res = await raw(path, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const qs = (params) => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const api = {
  // ── Authentification (POST /api/auth/login | refresh | logout, GET me) ──
  login: (userName, password) => request('/auth/login', { method: 'POST', body: { userName, password } }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST', body: { refreshToken: getRefreshToken() || '' } }),
  changerMotDePasse: (ancienMotDePasse, nouveauMotDePasse) => request('/auth/password', { method: 'POST', body: { ancienMotDePasse, nouveauMotDePasse } }),

  // ── Comptes (ADMIN) ────────────────────────────────────────────────────
  users: (groupe) => request(`/users${qs({ groupe })}`),
  user: (id) => request(`/users/${id}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  setUserActive: (id, isActive) => request(`/users/${id}/active`, { method: 'PATCH', body: isActive }),
  setUserGroupe: (id, groupe) => request(`/users/${id}/groupe`, { method: 'PATCH', body: groupe }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  reinitialiserMotDePasse: (id, nouveauMotDePasse) => request(`/users/${id}/password`, { method: 'PUT', body: { nouveauMotDePasse } }),

  // ── Équipements ────────────────────────────────────────────────────────
  equipements: (filters) => request(`/equipements${qs(filters)}`),
  equipement: (id) => request(`/equipements/${id}`),
  createEquipement: (body) => request('/equipements', { method: 'POST', body }),
  updateEquipement: (id, body) => request(`/equipements/${id}`, { method: 'PUT', body }),
  deleteEquipement: (id) => request(`/equipements/${id}`, { method: 'DELETE' }),

  // ── Gammes et étapes ───────────────────────────────────────────────────
  gammes: (filters) => request(`/gammes${qs(filters)}`),
  gamme: (id) => request(`/gammes/${id}`),
  gammesByClass: (classe) => request(`/gammes/by-class/${classe}`),
  createGamme: (body) => request('/gammes', { method: 'POST', body }),
  updateGamme: (id, body) => request(`/gammes/${id}`, { method: 'PUT', body }),
  deleteGamme: (id) => request(`/gammes/${id}`, { method: 'DELETE' }),
  addEtape: (gammeId, body) => request(`/gammes/${gammeId}/etapes`, { method: 'POST', body }),
  updateEtape: (gammeId, etapeId, body) => request(`/gammes/${gammeId}/etapes/${etapeId}`, { method: 'PUT', body }),
  deleteEtape: (gammeId, etapeId) => request(`/gammes/${gammeId}/etapes/${etapeId}`, { method: 'DELETE' }),

  validerGamme: (id, body) => request(`/gammes/${id}/valider`, { method: 'POST', body }),
  dupliquerGamme: (id, code, titre) => request(`/gammes/${id}/dupliquer`, { method: 'POST', body: { code, titre } }),

  ticketAssistance: (salle) => request('/assistance/ticket', { method: 'POST', body: { salle } }),

  // ── Visites d'essieu ──
  envoyerVisite: (body) => request('/visites', { method: 'POST', body }),
  visites: (filters) => request(`/visites${qs(filters)}`),
  dossierEssieu: (numero) => request(`/essieux/${encodeURIComponent(numero)}`),
  deciderEssieu: (numero, body) => request(`/essieux/${encodeURIComponent(numero)}/decisions`, { method: 'POST', body }),

  // ── Documents ──────────────────────────────────────────────────────────
  documents: (filters) => request(`/documents${qs(filters)}`),
  uploadDocument: (file, { typeDocument, equipementId, description }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('typeDocument', typeDocument);
    if (equipementId) form.append('equipementId', equipementId);
    if (description) form.append('description', description);
    return request('/documents', { method: 'POST', form });
  },
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  // Le téléchargement est authentifié : on récupère le blob puis on déclenche la sauvegarde.
  downloadDocument: async (id, filename) => {
    const res = await raw(`/documents/${id}/download`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // ── Maquettes 2D/3D (catalogue versionné, mêmes droits que les équipements) ──
  maquettes: () => request('/maquettes'),
  fichierMaquette: async (chemin) => (await raw(`/maquettes/${chemin}`)).arrayBuffer(),
  urlMaquette: (chemin) => `${BASE}/maquettes/${chemin}`,

  // ── Reconnaissance (proxy FastAPI) ─────────────────────────────────────
  infer: (sessionId, imageBase64) => request('/inference', { method: 'POST', body: { sessionId, imageBase64 } }),
  inferenceHealth: () => request('/inference/health'),

  // ── Tableaux de bord (ADMIN) ───────────────────────────────────────────
  dashboard: (days = 30) => request(`/kpi/dashboard${qs({ days })}`),
  interventions: (filters) => request(`/kpi/interventions${qs(filters)}`),
};

export default api;
