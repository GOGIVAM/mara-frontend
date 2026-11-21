# Guide d'installation : console web MA-RA

## Prérequis

- Node.js 18 ou plus récent, et npm
- API MA-RA (.NET) accessible ; par défaut `http://localhost:5080` en développement
- Navigateur récent avec WebGL (Chrome, Edge, Firefox) pour le jumeau numérique

## Développement

```bash
git clone https://github.com/GOGIVAM/mara-frontend
cd mara-frontend
copy .env.example .env
npm install
npm run dev
```

Console : http://localhost:5173. Le proxy Vite redirige `/api` vers `http://localhost:5080`
(`vite.config.js`).

## Production

1. Renseigner l'URL publique de l'API dans `.env` :
   `VITE_API_URL=https://<serveur-api>/api`
2. Construire : `npm ci` puis `npm run build`. Le résultat est dans `dist/`.
3. Servir `dist/` avec un serveur web statique (IIS, nginx). Toutes les routes inconnues
   doivent renvoyer `index.html` (application monopage). Exemple nginx :

```nginx
location / {
  try_files $uri /index.html;
}
```

4. Autoriser l'origine de la console dans la configuration CORS de l'API.
5. Servir la console en HTTPS : l'accès à la caméra (écran Reconnaissance) l'exige.

## Docker

Le `Dockerfile` fourni lance le serveur de développement (port 5173). Il convient pour une
démonstration, pas pour la production.

```bash
docker build -t mara-console .
docker run -p 5173:5173 mara-console
```

## Vérification

- La page de connexion s'affiche.
- La connexion avec un compte de test fonctionne (comptes listés dans le README).
- L'écran **Essieu T17** affiche l'essieu en 3D.
