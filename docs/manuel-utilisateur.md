# Manuel utilisateur : console MA-RA

Destiné aux agents DMAT, DIF et CI.

## Connexion

Ouvrir l'adresse de la console communiquée par la Coordination Informatique. Saisir
l'identifiant (par exemple `tech.dmat`) et le mot de passe. Après cinq échecs consécutifs,
le compte est verrouillé pendant quinze minutes. Pour se déconnecter, cliquer sur l'avatar
en haut à droite.

## Écrans

| Écran | Usage |
|---|---|
| Tableau de bord | Volume du référentiel ; indicateurs d'usage (ADMIN) |
| Reconnaissance | Identifier un équipement à la caméra, ou le sélectionner à la main |
| Équipements | Rechercher un équipement, consulter sa fiche |
| Gammes | Consulter les gammes et leurs étapes |
| Documents | Télécharger manuels, schémas et modèles 3D |
| Essieu T17 | Jumeau numérique, mode opératoire et fiche de contrôle |

## Essieu T17 : dérouler une visite (DMAT)

1. Ouvrir **Essieu T17**, puis l'onglet **Mode opératoire**.
2. Lire l'étape affichée sous la vue 3D. Le niveau de sécurité est indiqué en toutes lettres
   (Standard, Vigilance, Consignation). Ne jamais passer une étape de consignation sans l'avoir réalisée.
3. Avancer avec **Suivant** (ou la flèche →). **Répéter** rejoue le signal et, si la case est
   cochée, la lecture vocale. Sur casque RealWear, prononcer « Suivant », « Précédent » ou « Répéter ».
4. Cocher **Étape réalisée** au fil de l'eau.
5. La vue 3D se recentre sur le point à contrôler. La pièce concernée est mise en évidence
   et l'animation (rotation, vue éclatée) montre le geste attendu.

## Remplir la fiche de contrôle

1. Onglet **Fiche de contrôle** : saisir le numéro d'essieu et la date.
2. Pour chaque point, choisir **Conforme** ou **Non conforme**, saisir la valeur mesurée
   lorsqu'elle est demandée, et ajouter un commentaire si besoin. Le repère 3D prend la couleur du statut.
3. **Exporter CSV** produit le fichier à joindre au dossier de visite.
4. **Nouvelle fiche** efface la fiche en cours. Exporter la fiche avant de l'effacer.

La fiche reste enregistrée sur le poste utilisé, même après fermeture du navigateur.

## Que faire si…

| Situation | Action |
|---|---|
| La vue 3D ne s'affiche pas | Le poste ne prend pas en charge WebGL : les étapes et la fiche restent utilisables |
| « Session expirée » | Se reconnecter ; la fiche en cours est conservée |
| Un point est non conforme | Terminer la visite, retirer l'essieu du service et prévenir le chef d'équipe DMAT |
