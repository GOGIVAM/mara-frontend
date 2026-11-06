const MENTION = '[DÉMO, valeurs non validées] ';

/** Affiche la mention de démonstration sous forme de badge plutôt que dans le titre. */
export default function TitreGamme({ titre = '' }) {
  const demo = titre.startsWith(MENTION);
  return (
    <>
      {demo ? titre.slice(MENTION.length) : titre}
      {demo && <span className="badge-demo" title="Valeurs non validées par CAMRAIL">Démo</span>}
    </>
  );
}
