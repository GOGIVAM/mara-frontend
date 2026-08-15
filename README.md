# MA-RA Frontend

Application web React/Vite du projet CAMRAIL MA-RA. Elle permet d'utiliser les fonctionnalités métier du système : authentification, gestion des équipements, gammes, documents, suivi d'interventions et IA de reconnaissance.

## Prérequis

- Node.js 18+
- npm
- Un backend .NET démarré sur `http://localhost:5080`

## Configuration

Copier le fichier d'exemple en `.env` :

```bash
copy .env.example .env
```

Le fichier `.env.example` contient :

```env
VITE_API_URL=/api
```

Cela permet au proxy Vite de rediriger les appels `/api` vers le backend .NET local.

## Démarrage en développement

```bash
npm install
npm run dev
```

Le frontend est ensuite disponible sur :
- http://localhost:5173

## Construction de production

```bash
npm run build
```

Le build est généré dans le dossier `dist/`.

## Aperçu de l'architecture de communication

- Le frontend appelle le backend ASP.NET Core sur `http://localhost:5080`
- Le backend .NET expose les routes `/api/...`
- Le proxy Vite redirige `/api` vers le backend si `VITE_API_URL` vaut `/api`
- Les tokens JWT sont stockés dans le `localStorage` du navigateur

## Commandes utiles

```bash
npm install
npm run dev
npm run build
npm run preview -- --host
```

## Comptes de test

Le backend .NET crée automatiquement ces comptes au premier démarrage en mode `Development` :

| Utilisateur | Mot de passe | Groupe |
|---|---|---|
| `admin` | `Admin@Camrail2025!` | ADMIN |
| `tech.dmat` | `Tech@Dmat2025!` | DMAT |
| `chef.dmat` | `Chef@Dmat2025!` | DMAT |
| `tech.dif` | `Tech@Dif2025!` | DIF |
| `chef.dif` | `Chef@Dif2025!` | DIF |
| `coordinateur` | `Coord@CI2025!` | CI |
| `formateur` | `Form@CIF2025!` | CIF |

## Dépannage rapide

### Le frontend ne charge pas l'API

Vérifiez que le backend .NET est bien lancé et que le port `5080` est accessible :

```bash
curl http://localhost:5080/swagger
```

### Le proxy Vite ne redirige pas les requêtes

Vérifiez le fichier [vite.config.js](vite.config.js) et confirmez que le paramètre `VITE_API_URL` est bien défini.
