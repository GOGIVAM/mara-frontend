# Branche `demo` : MA-RA, console de maintenance augmentée

Cette branche contient la version de démonstration publiée sur https://mko-mara.vercel.app.
Toutes les données sont fictives et aucun appel ne part vers le backend .NET ni vers le
service IA FastAPI. **Simulation pédagogique, ce n'est pas le modèle entraîné.**

## Ce qui diffère de `master`

- `public/demo/mock-api.js`, injecté en tête de `index.html` uniquement par `npm run build:demo`
  (plugin `mara-demo-mock` de `vite.config.js`), intercepte fetch, XMLHttpRequest, WebSocket,
  EventSource et sendBeacon et sert les routes `/api/...` du backend (auth, users, equipements,
  gammes, documents, inference, kpi). Bandeau « Démo · données simulées · détection simulée ».
- Reconnaissance : en plus de la caméra, l'écran propose cinq images d'exemple
  (`public/demo/samples/*.svg`, illustrations générées pour la démo). Pour ces images, la
  détection et la classification sont prédéfinies avec un léger bruit ; la démo applique
  ensuite la logique réelle du pipeline : seuil θ_det = 0,45, fusion
  `0,35·s_det + 0,65·s_cls`, lissage sur 5 images par session, pré-activation Vuforia à 0,70,
  repli QR sans détection. Une image de la caméra ne produit aucune détection (aucun modèle
  n'est exécuté dans le navigateur).
- Tableau de bord et journal : calculés sur un journal d'interventions fictif (150 entrées)
  complété par les reconnaissances faites dans la démo. Ce ne sont pas des mesures réelles.
- Comptes fictifs `tech.dmat`, `tech.dif`, `admin.ci` (tout mot de passe est accepté).
- Logo et mentions de l'exploitant remplacés par un logo MA-RA ; référentiel, gammes et
  documents entièrement fictifs (le téléchargement renvoie un texte de démonstration).
- `.gitignore` : ajout de `node_modules/` et `dist/` ; correction d'un débordement horizontal
  de l'écran Reconnaissance à 390 px (`min-width: 0` sur la grille).

## Construire

```bash
npm ci
npm run build:demo   # sortie : dist/
```

Branche de référence du code : `master`. Cette branche n'est pas destinée à y être fusionnée.
