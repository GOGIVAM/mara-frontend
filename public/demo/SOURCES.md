# Visuels de démonstration MA-RA

**image generee par IA, aucune valeur documentaire, ne represente pas du materiel CAMRAIL**

Cette mention s'applique à chacun des deux fichiers. Il s'agit d'illustrations photoréalistes synthétiques, pas de photographies prises sur un site réel ni de plans constructeur. L'intention « voie métrique » du prompt ne constitue pas une preuve d'écartement ou de dimensions. Aucun visuel n'atteste la géométrie d'un essieu T17.

## Outil et provenance

- Outil : OpenAI, outil intégré `image_gen.imagegen` (exposé dans cette session comme `image_gen__imagegen`), mode de génération intégré ; compétence `imagegen`.
- Date : 7 novembre 2026.
- Aucune photographie externe, marque ou documentation constructeur utilisée comme référence.
- `gros-plan-boite.jpg` a été généré avec la première image IA comme référence visuelle de continuité, via `num_last_images_to_include=1`.
- Aucun modèle précis du générateur n'est exposé par le résultat de l'outil ; aucun nom de modèle n'est supposé.

## Fichiers livrés

| Fichier | Dimensions | Format | Taille |
| --- | --- | --- | --- |
| scene-atelier.jpg | 1664 × 936 px (16:9) | JPEG RGB | 595 448 octets |
| gros-plan-boite.jpg | 1664 × 936 px (16:9) | JPEG RGB | 623 709 octets |

Générations initiales : PNG 1672 × 941 px. Préparation des livrables avec Pillow : ajustement central minimal au rapport 16:9 et réduction Lanczos vers 1664 × 936 px, conversion JPEG qualité 94, sous-échantillonnage désactivé, encodage optimisé. Aucune reconstruction ou retouche mécanique par programme.

## Vérification visuelle

Images générées puis JPEG finaux inspectés. Scène d'ensemble : deux roues sur un axe commun, deux boîtes à l'extérieur des roues, un rail sous chaque bande de roulement ; technicien en EPI orange vu de dos avec tablette. Gros plan : boîtier fermé à hauteur de l'axe, au niveau du moyeu, et partie inférieure de la roue au contact du rail. Pas de roues manifestement désaxées ni de boîte fixée à la jante observées. Aucun logo, texte lisible, cote ou valeur repéré.

Il s'agit d'un contrôle de plausibilité visible, sans validation d'ingénierie ; les roulements étant cachés dans leurs boîtiers, leur constitution ne peut pas être vérifiée sur les images. Les détails d'atelier sont cohérents visuellement entre les deux vues, sans garantie de reconstruction photographique exacte.

Pour les captures et l'offre, conserver une légende indiquant clairement « Illustration générée par IA — sans valeur documentaire — aucun matériel CAMRAIL représenté ». Ces images ne mesurent aucune performance de reconnaissance sur du matériel réel et ne doivent pas être présentées comme corpus terrain CAMRAIL.

## Prompt exact — scene-atelier.jpg

```text
Use case: photorealistic-natural. Create ONE photorealistic editorial photograph for the MA-RA prototype equipment recognition demonstration. Landscape 16:9, 1920x1080 or larger, at least 1600 pixels wide. In a modest African railway maintenance workshop with concrete floor, corrugated roof and soft natural daylight through open doors: a single detached metre-gauge freight wagon wheelset resting on two short parallel storage rails. Mechanically coherent assembly: exactly two solid monobloc steel railway wheels press fitted perpendicular to ONE straight shared axle, wheels coaxial, flanges on the inside, rolling treads seated on separate parallel rails. Exactly two closed axlebox roller bearing housings, each mounted OUTBOARD of a wheel on its outer axle journal and concentric with the axle; no axlebox hanging off the rim, no extra wheel or axle, no bogie frame. View from slightly above axle height, three-quarter front so both wheels, connecting axle and both outboard bearing housings can be understood, complete wheelset inside the frame. Greasy dusty worked steel, believable wear without broken parts. One African railway technician wearing orange PPE coveralls with reflective strips, hard hat and safety boots stands alongside, seen from behind or side with face not identifiable, holding an unbranded rugged tablet with no readable screen. Realistic natural proportions and practical workshop staging. No logos, no readable inscriptions, no lettering, no numbers, no company branding, no CAMRAIL marks, no dimension lines or technical values, no watermark, no diagram, no collage. Illustration only, do not imply a documented specific T17 design.
```

## Prompt exact — gros-plan-boite.jpg

```text
Use case: photorealistic-natural. Generate ONE new close-up photograph using the previous generated workshop scene as a visual reference for continuity: SAME African railway workshop, same detached dusty greasy metre-gauge freight wagon wheelset, same natural daylight, concrete floor and storage rails. Landscape 16:9, ideally 1920x1080 or larger, at least 1600 pixels wide. Camera moves close to the RIGHT OUTBOARD axlebox shown in the reference. Show a mechanically plausible closed steel roller-bearing axlebox housing mounted concentrically on the axle journal immediately OUTSIDE the wheel hub, with natural cover fasteners, and the lower portion of that SAME monobloc railway wheel including tread contact on a single storage rail. Place the box near center-left and the lower wheel/tread in the lower-right, but preserve physical geometry rather than forcing layout. The axlebox must remain centered at the WHEEL AXIS height, never attached at bottom of wheel or to rim. Roller bearings are enclosed, not exposed. The wheel is vertical, the axle horizontal, the wheel tread actually rests on the rail head; flange is on the inboard side. Match housing shape and steel wear to reference. Background softly out of focus, workshop details matching previous photograph, an indistinct orange PPE-clad worker may be far behind, no identifiable face. Natural photographic texture, plausible engineering assembly, subtle grease and dust. No logos, no brands or CAMRAIL marks, no readable lettering, no numbers, no inscriptions, no dimension lines, no numeric values, no diagram, no cutaway, no extra axlebox, no wheel duplication, no watermark. This is only an AI illustration, not a documented specific T17 design.
```

