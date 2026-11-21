# Rapport de conception détaillée : console web MA-RA

## 1. Périmètre

Console web React de la solution MA-RA : authentification, référentiel équipements,
gammes et étapes, documents, reconnaissance d'équipement, tableaux de bord, comptes,
et module essieu T17 (jumeau numérique et mode opératoire).

## 2. Pile technique

| Élément | Choix |
|---|---|
| Interface | React 18, React Router 6 |
| 3D | three.js (chargé à la demande, écran T17 uniquement) |
| Outillage | Vite 6 |
| Communication | API REST `/api` (backend .NET), JWT Bearer avec jeton de rafraîchissement |

## 3. Organisation du code

```
src/
  api/client.js          client HTTP, gestion des jetons, rafraîchissement sur 401
  context/AuthContext.jsx session, groupe de l'utilisateur, isAdmin / inGroupe
  components/            barre supérieure, icônes, avatar
  lib/format.js          libellés (classes IA, groupes, statuts, sécurité)
  pages/                 un fichier par écran
  t17/
    model.js             référentiel T17 : pièces, points de contrôle, étapes, droits
    AxleViewer.jsx       jumeau numérique three.js
    audio.js             signaux sonores et lecture vocale
```

## 4. Module essieu T17

### 4.1 Données

`src/t17/model.js` est la source de vérité côté console :

- `PARTS` : pièces modélisées (corps, portées de calage, roues, fusées, boîtes) ;
- `CONTROL_POINTS` : 9 points (id, pièce, position 3D, instrument, critère, tolérance, unité) ;
- `STEPS` : 12 étapes (ordre, description de 80 caractères maximum, niveau de sécurité, durée, point, animation, détail) ;
- `PERMISSIONS` : droits par groupe ;
- `stepsToEtapes()` : conversion vers le DTO d'étape de l'API.

Le champ `tolerance` vaut `null` tant que la DMAT n'a pas transmis les cotes. L'interface
affiche alors « À valider (documentation DMAT) ».

### 4.2 Jumeau numérique

- Scène three.js, unités en mètres, axe de l'essieu porté par X.
- Géométries : cylindres (corps, portées, fusées), `LatheGeometry` pour les roues (profil
  avec boudin côté intérieur), boîtes d'essieu, rails à écartement métrique, sol.
- `OrbitControls` : rotation, zoom, déplacement.
- Repères : boutons HTML projetés à chaque image depuis les positions 3D, ce qui les garde
  cliquables et accessibles au clavier.
- Animations : interpolation de caméra (0,8 s), rotation de l'ensemble tournant, vue éclatée
  des boîtes (+0,30 m), pulsation de la pièce concernée.
- Repli : message explicite si WebGL n'est pas disponible ; le mode opératoire reste utilisable.

**Remplacement par le modèle CAO** : charger un fichier `public/models/t17.glb` avec
`GLTFLoader` et nommer les nœuds selon les clés de `PARTS` (`roue_g`, `roue_d`, `boite_g`…).
La surbrillance et la vue éclatée s'appuient sur ces noms. Les positions des repères dans
`CONTROL_POINTS` sont alors recalées sur le modèle.

### 4.3 Droits

| Action | DMAT | DIF | CI | CIF | ADMIN |
|---|---|---|---|---|---|
| Voir le jumeau et le mode opératoire | oui | non | oui | oui | oui |
| Mode formation | oui | non | non | oui | oui |
| Remplir la fiche de contrôle | oui | non | non | non | oui |
| Publier la gamme | non | non | non | non | oui |

Côté client, ces droits ne servent qu'à adapter l'affichage. Le contrôle effectif reste
celui de l'API (création de gammes réservée au groupe ADMIN).

### 4.4 Publication de la gamme

1. `GET /api/gammes?classeEquipement=bogie_essieux&activeOnly=false`, puis recherche du code `GM-T17-VIS`.
2. Si la gamme existe : `PUT /api/gammes/{id}`, puis suppression des étapes existantes.
   Sinon : `POST /api/gammes`.
3. `POST /api/gammes/{id}/etapes` pour chacune des 12 étapes, avec
   `arContentRef = T17/{point}/{animation}` pour l'application AR.

### 4.5 Fiche de contrôle

Conservée dans le `localStorage` du poste (clé `mara.t17.fiche`) et exportable en CSV
(séparateur `;`, encodage UTF-8 avec BOM, lisible dans Excel).

**Évolution back-end nécessaire** pour la traçabilité centralisée :

```
POST /api/controles
{ essieu: "T17", numero, date, agent, points: [{ id, statut, valeur, commentaire }], etapes: [ordre…] }
GET  /api/controles?numero=&from=&to=
```

## 5. Sécurité

- Jetons JWT dans le `localStorage`, rafraîchis automatiquement sur une réponse 401.
- Réponses 403 et 429 traduites en messages utilisateur.
- Aucun secret dans le dépôt ; `VITE_API_URL` est la seule variable de configuration.

## 6. Performances

- three.js est isolé dans un chunk chargé à la demande (environ 140 Ko gzip) : les autres écrans n'en paient pas le coût.
- Le rendu est limité à un ratio de pixels de 2 et les ressources GPU sont libérées en quittant l'écran.
