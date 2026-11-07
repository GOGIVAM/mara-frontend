/**
 * Plan 2D d'un axe, dessiné depuis le profil du fichier de métadonnées :
 * demi-profil (x, rayon) en millimètres, symétrique par rapport au milieu.
 */
export default function PlanAxe({ meta, organe, choisir }) {
  const L = meta.profil.at(-1)[0] * 2;
  const rMax = Math.max(...meta.profil.map(([, r]) => r));
  const moitie = meta.profil;
  const complet = [...moitie, ...[...moitie].reverse().map(([x, r]) => [L - x, r])];
  const haut = complet.map(([x, r]) => `${x},${-r}`).join(' ');
  const bas = [...complet].reverse().map(([x, r]) => `${x},${r}`).join(' ');
  const marge = 60;

  // Zones cliquables par organe, à partir des bornes du profil
  const zones = [];
  let debut = 0;
  for (const [nom, fin] of meta.zones || []) {
    zones.push([nom, debut, fin], [nom, L - fin, L - debut]);
    debut = fin;
  }

  return (
    <figure className="plan-axe">
      <svg viewBox={`${-marge} ${-rMax - marge} ${L + 2 * marge} ${2 * rMax + 2 * marge + 40}`} role="img"
        aria-label={`Plan de l'${meta.titre.toLowerCase()}`}>
        <line x1={-30} y1={0} x2={L + 30} y2={0} className="plan-axe-centre" />
        <polygon points={`${haut} ${bas}`} className="plan-axe-contour" />
        {zones.map(([nom, a, b]) => (
          <rect key={`${nom}-${a}`} x={a} y={-rMax} width={b - a} height={2 * rMax}
            className={`plan-axe-zone${organe === nom ? ' plan-axe-zone-active' : ''}`}
            onClick={() => choisir(nom)}><title>{meta.organes[nom]?.nom}</title></rect>
        ))}
        <line x1={0} y1={rMax + 30} x2={L} y2={rMax + 30} className="plan-axe-cote" />
        <text x={L / 2} y={rMax + 24} textAnchor="middle" className="plan-axe-texte">{L} mm</text>
      </svg>
      <figcaption>{meta.source}</figcaption>
    </figure>
  );
}
