# Dossier de tests et recette : module essieu T17

Chaque cas indique le résultat attendu. La colonne « Résultat » est à remplir lors de la recette
(OK / KO, date, testeur).

## 1. Tests fonctionnels (console web)

| N° | Cas | Étapes | Résultat attendu | Résultat |
|---|---|---|---|---|
| F01 | Accès DMAT | Connexion `tech.dmat`, menu « Essieu T17 » | Onglets Jumeau, Mode opératoire, Formation, Fiche ; pas de bouton Publier | |
| F02 | Accès CIF | Connexion `formateur` | Onglets Jumeau, Mode opératoire, Formation ; pas de Fiche | |
| F03 | Accès CI | Connexion `coordinateur` | Onglets Jumeau et Mode opératoire uniquement | |
| F04 | Accès DIF | Connexion `tech.dif` | Pas d'entrée « Essieu T17 » ; l'URL `/essieu-t17` affiche « réservé » | |
| F05 | Jumeau 3D | Glisser, molette, clic droit | Rotation, zoom et déplacement fluides | |
| F06 | Repère | Cliquer sur le repère 02 | Caméra recentrée, roues en surbrillance, fiche du point affichée | |
| F07 | Vue d'ensemble | Bouton « Vue d'ensemble » | Retour à la position initiale | |
| F08 | Navigation des étapes | Suivant, Précédent, flèches ← → | Étape suivante ou précédente, barre de progression mise à jour | |
| F09 | Animation rotation | Étape 3 | L'essieu tourne ; repère 01 actif | |
| F10 | Vue éclatée | Étape 10 | Les boîtes d'essieu s'écartent, repère 08 suit la boîte | |
| F11 | Signal consignation | Étape 1 ou 12 | Signal d'alerte (trois tonalités) ; détail de sécurité affiché | |
| F12 | Lecture vocale | Cocher « Lecture vocale », puis Répéter | Étape lue en français | |
| F13 | Mode formation | Onglet Formation | Instrument et critère affichés pour chaque étape avec point | |
| F14 | Fiche : statut | Fiche, P01 « Non conforme » | Repère 01 rouge ; signal sonore grave | |
| F15 | Fiche : persistance | Saisir une valeur, recharger la page | Valeur conservée | |
| F16 | Fiche : export | « Exporter CSV » | Fichier `fiche-T17-<numéro>-<date>.csv` lisible dans Excel, accents corrects | |
| F17 | Fin avec non-conformité | Une NC, puis Terminer à l'étape 12 | Message demandant le retrait de l'essieu | |
| F18 | Publication (création) | ADMIN, « Publier la gamme » sur une base sans `GM-T17-VIS` | Gamme créée avec 12 étapes, visible dans l'écran Gammes | |
| F19 | Publication (mise à jour) | Publier une seconde fois | Confirmation demandée ; 12 étapes, sans doublon | |
| F20 | Sans WebGL | Navigateur sans WebGL | Message explicite ; étapes et fiche utilisables | |

## 2. Tests non fonctionnels

| N° | Cas | Critère d'acceptation | Résultat |
|---|---|---|---|
| N01 | Chargement de l'écran T17 | Moins de 3 s sur le Wi-Fi atelier | |
| N02 | Fluidité 3D | Pas de saccade visible sur un poste atelier standard | |
| N03 | Affichage mobile (390 px) | Pas de défilement horizontal ; boutons utilisables | |
| N04 | Session expirée | Jeton expiré pendant la fiche | Rafraîchissement transparent, fiche conservée | |
| N05 | Droits côté API | `POST /api/gammes` avec un compte DMAT | Réponse 403 | |

## 3. Recette en atelier (DMAT)

| N° | Cas | Critère | Résultat |
|---|---|---|---|
| R01 | Déroulé complet sur un essieu T17 réel | Les 12 étapes réalisées dans l'ordre sans retour au papier | |
| R02 | Conformité des étapes | Le référent DMAT valide chaque description et chaque critère | |
| R03 | Tolérances | Les tolérances de la documentation T17 sont saisies et vérifiées | |
| R04 | Lisibilité RealWear | Descriptions lisibles (80 caractères) et commandes vocales Suivant / Précédent / Répéter | |
| R05 | Traçabilité | La fiche exportée est acceptée comme pièce du dossier de visite | |

Procès-verbal de recette : date, participants, réserves, décision (acceptée, acceptée avec réserves, refusée).
