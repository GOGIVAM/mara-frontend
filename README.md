# MA-RA — Frontend (React + Vite)

Console web CAMRAIL branchée sur le backend .NET **MaRa.Api**
(`GOGIVAM/ma_ra_backend`, branche `master`). L'application AR embarquée
(Unity + Vuforia, RealWear Navigator 520) consomme la même API.

## Écrans et routes API consommées

| Route | Écran | Endpoints backend |
| --- | --- | --- |
| `/` | Tableau de bord | `GET /api/kpi/dashboard` (ADMIN) — volumétrie référentiel sinon |
| `/scan` | Reconnaissance | `POST /api/inference`, `GET /api/inference/health`, `GET /api/gammes/by-class/{classe}` |
| `/equipements` | Parc CAMRAIL | `GET/POST/PUT/DELETE /api/equipements` |
| `/gammes` | Gammes et étapes | `GET/POST/PUT/DELETE /api/gammes` et `/api/gammes/{id}/etapes` |
| `/documents` | Documents | `GET/POST/DELETE /api/documents`, `GET /api/documents/{id}/download` |
| `/journal` | Journal d'interventions | `GET /api/kpi/interventions` (ADMIN, paginé) |
| `/utilisateurs` | Comptes | `GET/POST /api/users`, `PATCH /{id}/active`, `PATCH /{id}/groupe`, `DELETE /{id}` (ADMIN) |

Authentification : `POST /api/auth/login` (identifiant + mot de passe),
`POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/logout`.

## Habilitations

Le backend porte le groupe dans le claim `groupe` : `DMAT`, `DIF`, `CI`, `CIF`, `ADMIN`.
Les écrans Journal et Utilisateurs, ainsi que les actions de création, modification,
suppression et téléversement, ne s'affichent que pour le groupe `ADMIN` — le backend
les refuse de toute façon (403, restitué à l'écran).

## Configuration

Copier `.env.example` en `.env` :

```
VITE_API_URL=https://<votre-backend>/api
```

Sans variable, l'application appelle `/api`, proxifié par Vite vers
`http://localhost:5080` (voir `vite.config.js`). Le jeton JWT est conservé dans
`localStorage` sous `mara.token`, le refresh token sous `mara.refresh` ; un 401
déclenche automatiquement `POST /api/auth/refresh` puis rejoue la requête.

Le backend n'autorise que les origines déclarées dans `Cors:AllowedOrigins`
(`http://localhost:3000` et `https://mara.camrail.cm` par défaut) : ajoutez-y
`http://localhost:5173` ou passez par le proxy Vite.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # bundle de production dans dist/
```

## Comptes de démonstration (seed backend, `SeedDb=true`)

`admin`, `tech.dmat`, `chef.dmat`, `tech.dif`, `chef.dif`, `coordinateur`, `formateur`.
