# Manuel administrateur : console MA-RA

Destiné aux comptes du groupe ADMIN (Coordination Informatique).

## Comptes et groupes

Écran **Utilisateurs** : créer un compte, l'activer ou le désactiver, changer son groupe.

| Groupe | Population | Droits sur le module T17 |
|---|---|---|
| DMAT | Agents et chefs du Matériel | Consulter, formation, fiche de contrôle |
| DIF | Infrastructure | Aucun |
| CI | Coordination | Consulter |
| CIF | Formateurs | Consulter, formation |
| ADMIN | Administration | Tout, y compris publier la gamme |

Pour modifier ces droits, éditer `PERMISSIONS` dans `src/t17/model.js`, puis reconstruire et redéployer la console.

## Publier la gamme T17

**Essieu T17**, puis **Publier la gamme** : crée ou met à jour la gamme `GM-T17-VIS`
(classe `bogie_essieux`, direction DMAT) avec ses 12 étapes. L'application AR de terrain lit
cette gamme. À refaire après toute modification de `src/t17/model.js`.

## Saisir les tolérances T17

À réception de la documentation DMAT, renseigner `tolerance` (texte affiché, par exemple
`25 à 33 mm`) pour chaque point de `CONTROL_POINTS` dans `src/t17/model.js`, faire valider
par le référent DMAT, redéployer, puis republier la gamme.

## Ajouter un scénario

Dupliquer `src/t17/model.js` pour le nouvel organe, adapter les pièces, les points et les
étapes, puis ajouter une route et une entrée de menu (`src/App.jsx`, `src/components/TopBar.jsx`).

## Exploitation

- Surveillance : l'icône cloche de la barre supérieure signale l'indisponibilité du service de reconnaissance.
- Journal : l'écran **Journal** liste les reconnaissances effectuées.
- Sauvegardes : à faire sur la base de l'API et le stockage des documents (la console web n'a pas de données propres).
- Support : voir la section 7 de `docs/offre-technique.md`.
