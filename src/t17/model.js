/**
 * Référentiel de l'essieu T17 : pièces du jumeau numérique, points de contrôle
 * et mode opératoire affiché pas à pas (console web et casque RealWear).
 *
 * Unités de la scène 3D : mètre. Axe de l'essieu porté par X, origine au centre.
 *
 * IMPORTANT : les tolérances chiffrées ne sont pas inventées ici. Tant que la
 * documentation technique T17 n'a pas été transmise par la DMAT, le champ
 * `critere` décrit ce qu'il faut mesurer et `tolerance` vaut null (« à valider DMAT »).
 */

export const T17 = {
  code: 'T17',
  classe: 'bogie_essieux',
  direction: 'DMAT',
  gammeCode: 'GM-T17-VIS',
  gammeTitre: 'Essieu T17 : visite et contrôle dimensionnel',
};

/** Pièces modélisées. `group` sert à la mise en surbrillance et à la vue éclatée. */
export const PARTS = {
  corps: { label: "Corps d'essieu", description: "Arbre reliant les deux roues, siège des contraintes de flexion rotative." },
  portee: { label: 'Portées de calage', description: 'Zones où les roues sont emmanchées à force sur l\'essieu.' },
  roue: { label: 'Roues monobloc', description: 'Table de roulement, boudin, toile et moyeu.' },
  fusee: { label: 'Fusées', description: "Extrémités de l'essieu recevant les roulements." },
  boite: { label: "Boîtes d'essieu", description: 'Logement des roulements, couvercle et fixation sur le bogie.' },
};

export const SAFETY = { NONE: 'NONE', ORANGE: 'ORANGE', ROUGE: 'ROUGE' };

/**
 * Points de contrôle (repères visuels de la scène).
 * position : coordonnées du repère ; part : pièce mise en surbrillance.
 */
export const CONTROL_POINTS = [
  {
    id: 'P01', part: 'roue', position: [0.53, -0.43, 0.0],
    label: 'Table de roulement',
    instrument: 'Inspection visuelle, lampe, gabarit de méplat',
    critere: 'Absence de méplat, écaillage, fissure ou apport de métal sur la table.',
    tolerance: null, mesure: false,
  },
  {
    id: 'P02', part: 'roue', position: [0.47, 0.455, 0.0],
    label: 'Boudin : hauteur et épaisseur',
    instrument: 'Jauge de profil de roue',
    critere: "Relever la hauteur et l'épaisseur du boudin et la cote qR sur chaque roue.",
    tolerance: null, mesure: true, unite: 'mm',
  },
  {
    id: 'P03', part: 'roue', position: [-0.53, 0.43, 0.0],
    label: 'Diamètre de roulement',
    instrument: 'Compas à diamètre ou ruban circonférentiel',
    critere: "Mesurer le diamètre des deux roues et l'écart entre elles.",
    tolerance: null, mesure: true, unite: 'mm',
  },
  {
    id: 'P04', part: 'roue', position: [0.0, 0.3, 0.0],
    label: 'Écartement des faces internes',
    instrument: "Pige d'écartement",
    critere: 'Mesurer la distance entre faces internes en trois points à 120°.',
    tolerance: null, mesure: true, unite: 'mm',
  },
  {
    id: 'P05', part: 'corps', position: [0.18, 0.09, 0.0],
    label: "Corps d'essieu",
    instrument: 'Inspection visuelle, contrôle non destructif (ultrasons ou magnétoscopie)',
    critere: 'Absence de fissure, choc, corrosion ou trace de frottement.',
    tolerance: null, mesure: false,
  },
  {
    id: 'P06', part: 'portee', position: [-0.44, -0.11, 0.0],
    label: 'Calage des roues',
    instrument: 'Repère témoin peint essieu / moyeu',
    critere: 'Le repère témoin doit être continu : aucun décalage roue / essieu.',
    tolerance: null, mesure: false,
  },
  {
    id: 'P07', part: 'boite', position: [0.78, 0.17, 0.0],
    label: "Boîte d'essieu : température",
    instrument: 'Thermomètre infrarouge',
    critere: 'Relever la température des deux boîtes en fin de marche et comparer.',
    tolerance: null, mesure: true, unite: '°C',
  },
  {
    id: 'P08', part: 'boite', position: [-0.9, 0.0, 0.14],
    label: 'Couvercle et étanchéité',
    instrument: 'Inspection visuelle, clé dynamométrique',
    critere: 'Absence de fuite de graisse, couvercle et vis en place et serrées.',
    tolerance: null, mesure: false,
  },
  {
    id: 'P09', part: 'fusee', position: [0.72, -0.08, 0.0],
    label: 'Roulements',
    instrument: "Rotation manuelle de l'essieu levé",
    critere: 'Rotation libre, sans point dur, bruit anormal ni jeu axial perceptible.',
    tolerance: null, mesure: false,
  },
];

/**
 * Mode opératoire. description : 80 caractères max (contrainte d'affichage RealWear).
 * animation : focus (caméra sur le repère) | rotate (essieu en rotation) | explode (vue éclatée).
 */
export const STEPS = [
  {
    ordre: 1, niveauSecurite: SAFETY.ROUGE, duree: 300, point: null, animation: 'overview',
    description: 'Consigner le véhicule : freins serrés, cales posées, signalisation',
    detail: "Aucune intervention sous le véhicule tant que la consignation n'est pas confirmée par le chef d'équipe.",
  },
  {
    ordre: 2, niveauSecurite: SAFETY.ORANGE, duree: 120, point: null, animation: 'overview',
    description: "Nettoyer l'essieu et identifier son numéro de série",
    detail: 'Reporter le numéro gravé sur le corps ou le moyeu dans la fiche de contrôle.',
  },
  {
    ordre: 3, niveauSecurite: SAFETY.NONE, duree: 240, point: 'P01', animation: 'rotate',
    description: 'Inspecter les tables de roulement sur un tour complet',
  },
  {
    ordre: 4, niveauSecurite: SAFETY.NONE, duree: 300, point: 'P02', animation: 'focus',
    description: 'Mesurer hauteur, épaisseur de boudin et qR sur chaque roue',
  },
  {
    ordre: 5, niveauSecurite: SAFETY.NONE, duree: 240, point: 'P03', animation: 'focus',
    description: 'Mesurer le diamètre des deux roues',
  },
  {
    ordre: 6, niveauSecurite: SAFETY.NONE, duree: 180, point: 'P04', animation: 'focus',
    description: 'Mesurer l\'écartement des faces internes en trois points',
  },
  {
    ordre: 7, niveauSecurite: SAFETY.ORANGE, duree: 600, point: 'P05', animation: 'focus',
    description: "Contrôler le corps d'essieu (visuel puis CND)",
    detail: 'Le contrôle par ultrasons est réalisé par un agent certifié CND.',
  },
  {
    ordre: 8, niveauSecurite: SAFETY.NONE, duree: 120, point: 'P06', animation: 'focus',
    description: 'Vérifier la continuité des repères de calage',
  },
  {
    ordre: 9, niveauSecurite: SAFETY.ORANGE, duree: 180, point: 'P07', animation: 'focus',
    description: "Relever la température des boîtes d'essieu",
    detail: 'Surface potentiellement chaude : gants obligatoires.',
  },
  {
    ordre: 10, niveauSecurite: SAFETY.NONE, duree: 180, point: 'P08', animation: 'explode',
    description: 'Contrôler couvercles, vis et étanchéité des boîtes',
  },
  {
    ordre: 11, niveauSecurite: SAFETY.ORANGE, duree: 240, point: 'P09', animation: 'rotate',
    description: "Faire tourner l'essieu levé et écouter les roulements",
    detail: "Essieu levé et calé : ne jamais placer les mains entre roue et rail.",
  },
  {
    ordre: 12, niveauSecurite: SAFETY.ROUGE, duree: 180, point: null, animation: 'overview',
    description: 'Lever la consignation et signer la fiche de contrôle',
  },
];

export const pointById = (id) => CONTROL_POINTS.find((p) => p.id === id) || null;

/**
 * Droits par groupe de sécurité sur le module T17.
 * - view : consulter le jumeau numérique et le mode opératoire
 * - execute : dérouler le mode opératoire et remplir une fiche de contrôle
 * - train : mode formation (détails, explications, sans fiche)
 * - publish : publier le mode opératoire comme gamme dans le back-end
 */
export const PERMISSIONS = {
  view: ['DMAT', 'CI', 'CIF', 'ADMIN'],
  execute: ['DMAT', 'ADMIN'],
  train: ['DMAT', 'CIF', 'ADMIN'],
  publish: ['ADMIN'],
};

export const can = (groupe, action) => (PERMISSIONS[action] || []).includes(groupe);

/** Conversion du mode opératoire vers les DTO d'étapes du back-end (/api/gammes/{id}/etapes). */
export const stepsToEtapes = () => STEPS.map((s) => {
  const p = pointById(s.point);
  return {
    ordreIndex: s.ordre,
    description: s.description.slice(0, 80),
    niveauSecurite: s.niveauSecurite,
    dureeSecondes: s.duree,
    arContentRef: `T17/${s.point || 'vue-globale'}/${s.animation}`,
    detail: [s.detail, p && `${p.instrument}. ${p.critere}`].filter(Boolean).join(' ') || null,
  };
});
