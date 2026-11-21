# Offre technique : maintenance augmentée de l'essieu T17

Projet MA-RA (Maintenance augmentée, réalité augmentée) pour CAMRAIL, Direction du Matériel (DMAT).

> Document de travail. Les éléments notés **[à compléter]** dépendent d'informations
> que l'équipe doit fournir (composition de l'équipe, CV, dates) ou que CAMRAIL doit
> transmettre (documentation technique T17).

## 1. Compréhension du besoin

CAMRAIL souhaite outiller ses agents de maintenance pour la visite des essieux T17.
L'agent doit savoir quelles opérations réaliser, dans quel ordre, avec quels instruments
et selon quels critères, sans dépendre d'une documentation papier dispersée.

Opérations couvertes, mises en œuvre dans le module `/essieu-t17` (`src/t17/model.js`) :

| Étape | Opération | Point de contrôle | Sécurité |
|---|---|---|---|
| 1 | Consignation du véhicule | — | Consignation |
| 2 | Nettoyage, identification du numéro d'essieu | — | Vigilance |
| 3 | Inspection des tables de roulement | P01 | Standard |
| 4 | Mesure du boudin (hauteur, épaisseur, qR) | P02 | Standard |
| 5 | Mesure du diamètre de roulement | P03 | Standard |
| 6 | Écartement des faces internes | P04 | Standard |
| 7 | Contrôle du corps d'essieu (visuel puis CND) | P05 | Vigilance |
| 8 | Continuité des repères de calage | P06 | Standard |
| 9 | Température des boîtes d'essieu | P07 | Vigilance |
| 10 | Couvercles, vis, étanchéité des boîtes | P08 | Standard |
| 11 | Rotation de l'essieu levé, écoute des roulements | P09 | Vigilance |
| 12 | Levée de consignation, signature de la fiche | — | Consignation |

Problèmes que l'outil doit résoudre :

- hétérogénéité des pratiques entre agents et entre ateliers ;
- oubli d'un point de contrôle ou d'une étape de sécurité ;
- traçabilité insuffisante des mesures relevées ;
- temps de formation des nouveaux agents ;
- accès à la bonne documentation au pied de l'essieu.

Les tolérances chiffrées (cotes limites de boudin, diamètre minimal, écartement, seuils de
température) ne figurent pas encore dans l'outil : elles seront reprises de la documentation
T17 fournie par la DMAT (voir section 8).

## 2. Solution proposée

### Architecture

```
 Casque RealWear / tablette Android ──┐
   (application AR Unity + Vuforia)   │
                                      ├──► API MA-RA (.NET, /api) ──► base de données
 Console web (ce dépôt, React/Vite) ──┘          │                      documents
   jumeau numérique 3D, gammes,                  └──► service IA (FastAPI)
   fiches de contrôle, administration                 reconnaissance d'équipement
```

- **Console web** (ce dépôt) : React 18, React Router, three.js pour le jumeau numérique.
  Elle sert à préparer et publier les gammes, à former, à consulter et à administrer.
- **API MA-RA** (.NET) : authentification JWT, groupes de sécurité, référentiel
  équipements, gammes et étapes, documents, indicateurs.
- **Service de reconnaissance** (FastAPI) : identification de la classe d'équipement à partir
  d'une image (classe `bogie_essieux` pour l'essieu), avec repli sur marqueur QR.
- **Application de terrain** : Unity avec Vuforia, sur casque RealWear et tablette Android.
  Elle lit la gamme publiée (`GM-T17-VIS`) et affiche chaque étape en réalité augmentée.
  Le champ `arContentRef` (`T17/P02/focus`, par exemple) relie l'étape à l'animation et au repère.

### Reconnaissance

Deux modes sont prévus, dans cet ordre :

1. **À partir du modèle CAO** (Vuforia Model Targets) : l'essieu est reconnu par sa
   géométrie, sans marqueur collé. Ce mode nécessite le modèle CAO T17.
2. **Par marqueur** (image ou QR fixé sur la boîte d'essieu) : solution de repli lorsque
   l'éclairage ou l'encrassement empêche la reconnaissance par forme. Le champ
   « Marqueur Vuforia » du référentiel équipements porte l'identifiant du marqueur.

### Plateformes visées

| Plateforme | Usage |
|---|---|
| Casque RealWear (Android) | Intervention mains libres, commandes vocales |
| Tablette Android | Intervention et formation en atelier |
| Smartphone Android | Consultation rapide |
| Poste Windows (navigateur) | Console web : préparation, formation, administration |

## 3. Contenu fonctionnel

| Exigence | Réalisation dans la console | Fichier |
|---|---|---|
| Maquette 3D (jumeau numérique) | Essieu modélisé (corps, portées, roues à boudin, fusées, boîtes, rails), rotation, zoom, déplacement | `src/t17/AxleViewer.jsx` |
| Étapes du mode opératoire | 12 étapes, niveau de sécurité et durée, navigation Précédent / Suivant / Répéter, clavier ← → | `src/pages/EssieuT17.jsx` |
| Repères visuels | 9 repères numérotés, pièce concernée en surbrillance, caméra recentrée sur le point | `src/t17/AxleViewer.jsx` |
| Animations | Recentrage de caméra, rotation de l'essieu (tables, roulements), vue éclatée (boîtes) | `src/t17/AxleViewer.jsx` |
| Son | Signaux sonores (étape, alerte consignation, non-conformité), lecture vocale des étapes en français | `src/t17/audio.js` |
| Navigation | Onglets Jumeau numérique, Mode opératoire, Formation, Fiche de contrôle | `src/pages/EssieuT17.jsx` |
| Accès par groupes de sécurité | DMAT exécute, CIF forme, CI consulte, ADMIN publie ; DIF sans accès | `src/t17/model.js` (`PERMISSIONS`) |
| Traçabilité | Fiche de contrôle (conforme / non conforme, valeur, commentaire), export CSV | `src/pages/EssieuT17.jsx` |
| Diffusion vers le terrain | Bouton « Publier la gamme » : crée ou met à jour `GM-T17-VIS` et ses étapes dans l'API | `src/pages/EssieuT17.jsx` |

Le modèle 3D actuel est procédural : il reproduit la composition et les proportions
générales d'un essieu à voie métrique. Il sera remplacé par le modèle CAO T17 dès sa
réception (format glTF/GLB, voir `docs/conception-detaillee.md`).

## 4. Méthodologie et planning

Démarche itérative, avec une démonstration à la DMAT à la fin de chaque phase.
Durées proposées, à ajuster avec CAMRAIL **[à valider]** :

| Phase | Contenu | Durée proposée |
|---|---|---|
| 1. Collecte | Documentation T17, gammes papier existantes, visite atelier, photos, cotes | 2 semaines |
| 2. Modélisation 3D | Modèle CAO ou relevé, simplification, export glTF, Model Target Vuforia | 3 semaines |
| 3. Développement | Console web (fait pour la base), application AR, intégration API, contenus AR par étape | 6 semaines |
| 4. Tests | Tests fonctionnels, tests en atelier, sécurité, performances sur RealWear | 2 semaines |
| 5. Recette | Recette DMAT sur essieux réels selon `docs/dossier-tests-recette.md` | 1 semaine |
| 6. Déploiement | Installation, comptes, formation des formateurs CIF, mise en service | 2 semaines |

Total indicatif : 16 semaines.

## 5. Équipe

**[à compléter]** Noms et CV à joindre en annexe.

| Rôle | Responsabilités |
|---|---|
| Chef de projet | Planning, relation DMAT, comités, recette |
| Développeur web / API | Console React, API .NET, sécurité, déploiement |
| Développeur AR | Application Unity / Vuforia, RealWear, contenus par étape |
| Modélisateur 3D | Modèle de l'essieu, optimisation, Model Target |
| Data scientist | Service de reconnaissance, jeu de données, entraînement |
| Référent métier DMAT (CAMRAIL) | Validation des étapes, des critères et des tolérances |

## 6. Livrables (section V du cahier des charges)

| Livrable | Emplacement |
|---|---|
| Application (console web, API, application AR) | ce dépôt ; dépôts API et AR |
| Rapport de conception détaillée | `docs/conception-detaillee.md` |
| Dossier de tests et recette | `docs/dossier-tests-recette.md` |
| Manuel utilisateur | `docs/manuel-utilisateur.md` |
| Manuel formateur | `docs/manuel-formateur.md` |
| Manuel administrateur | `docs/manuel-administrateur.md` |
| Licences | `docs/licences.md` |
| Guide d'installation | `docs/guide-installation.md` |

## 7. Support après livraison

- **Mises à jour correctives et évolutives** : publication d'une nouvelle version de la console et de l'application AR, notes de version jointes.
- **Ajout de scénarios** : un nouveau mode opératoire (autre essieu, autre organe) se décrit dans un fichier de référentiel du même format que `src/t17/model.js`, puis se publie comme gamme. Les contenus AR associés sont livrés avec l'application terrain.
- **Hotline** : point de contact unique **[à compléter : téléphone, courriel, horaires]**, avec prise en charge selon la gravité (bloquant, majeur, mineur).
- **Assistance à distance** : prise en main du poste ou partage d'écran du casque RealWear, consultation des journaux de l'API.

## 8. Prérequis côté CAMRAIL

- **Matériel** : casques RealWear et/ou tablettes Android, réseau Wi-Fi dans l'atelier, un serveur (ou une VM) pour l'API et la base, postes Windows avec un navigateur récent (WebGL).
- **Documentation technique T17** : plans et modèle CAO de l'essieu, cotes et tolérances (boudin, diamètre, écartement), gammes de visite en vigueur, procédure de consignation, seuils de température des boîtes, exigences CND.
- **Accès à l'atelier** : créneaux de visite, essieux T17 disponibles pour la modélisation, les photos, les tests et la recette, et un référent DMAT désigné.
- **Comptes et sécurité** : liste des agents par groupe (DMAT, DIF, CI, CIF, ADMIN), règles de mot de passe, contraintes réseau.
