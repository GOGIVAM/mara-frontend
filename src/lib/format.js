/** Libellés alignés sur les valeurs du backend (classes IA, groupes, sécurité). */
export const CLASS_LABELS = {
  moteur_traction: 'Moteur de traction',
  bogie_essieux: 'Bogie / essieux',
  compresseur: 'Compresseur',
  pompe_eau: 'Pompe à eau',
  grue_ferroviaire: 'Grue ferroviaire',
  pont_roulant: 'Pont roulant',
  tours_atelier: "Tour d'atelier",
  draisine: 'Draisine',
  aiguillage: 'Aiguillage',
  transformateur_ht: 'Transformateur HT',
  groupe_electrogene: 'Groupe électrogène',
  signal_ferroviaire: 'Signal ferroviaire',
};

export const CLASSES = Object.keys(CLASS_LABELS);

export const classLabel = (c) => CLASS_LABELS[c] || c || '';

export const GROUPES = ['DMAT', 'DIF', 'CI', 'CIF', 'CMSF', 'ADMIN'];

/** Groupes qui enregistrent des visites et des reconnaissances ; CMSF consulte. */
export const GROUPES_TERRAIN = ['DMAT', 'DIF', 'CI', 'CIF', 'ADMIN'];

export const GROUPE_LABELS = {
  DMAT: 'DMAT · Matériel',
  DIF: 'DIF · Infrastructure',
  CI: 'CI · Coordination',
  CIF: 'CIF · Formation',
  CMSF: 'CMSF · Sécurité ferroviaire',
  ADMIN: 'Administration',
};

export const DIRECTIONS = ['DMAT', 'DIF'];

export const STATUTS = ['actif', 'maintenance', 'reforme'];

export const STATUT_LABELS = {
  actif: 'Actif',
  maintenance: 'En maintenance',
  reforme: 'Réformé',
};

export const TYPES_DOCUMENT = ['manuel', 'schema', 'gamme', 'modele3d', 'autre'];

export const TYPE_DOC_LABELS = {
  manuel: 'Manuel',
  schema: 'Schéma',
  gamme: 'Gamme',
  modele3d: 'Modèle 3D',
  autre: 'Autre',
};

/** NONE | ORANGE | ROUGE → classes CSS des étapes. */
export const SAFETY_CLASS = { NONE: 'vert', ORANGE: 'orange', ROUGE: 'rouge' };
export const SAFETY_LEVELS = ['NONE', 'ORANGE', 'ROUGE'];
export const SAFETY_LABELS = { NONE: 'Standard', ORANGE: 'Vigilance', ROUGE: 'Consignation' };

export function initials(name = '') {
  return name.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function avatarColor(seed = '') {
  const palette = ['#F3D3CF', '#E4E3E3', '#F0DCD8', '#DCDBDB', '#F6E0DC', '#E9E8E8', '#EFD6D2'];
  let sum = 0;
  for (const c of seed) sum += c.charCodeAt(0);
  return palette[sum % palette.length];
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} min`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h`;
  const days = Math.round(diff / 86400);
  return days === 1 ? '1 jour' : `${days} jours`;
}

export function timestamp(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

export const percent = (v) => `${Math.round((v || 0) * 100)} %`;
