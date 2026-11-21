import { useEffect, useRef, useState } from 'react';

/** Vrai si l'utilisateur a demandé à réduire les animations (réglage système). */
export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
};

export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Anime un nombre de sa valeur précédente vers `target` (compteur).
 * Renvoie la valeur courante, ou `target` tel quel s'il n'est pas numérique.
 */
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(typeof target === 'number' ? 0 : target);
  // Dernière valeur affichée : point de départ de l'animation suivante.
  const shownRef = useRef(0);

  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) { setValue(target); return undefined; }
    if (prefersReducedMotion()) { setValue(target); shownRef.current = target; return undefined; }
    const from = shownRef.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (target - from) * easeOutExpo(t);
      shownRef.current = v;
      setValue(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

/** Nombre animé, mis en forme par `format` (entier par défaut). */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString('fr-FR') }) {
  const v = useCountUp(value);
  if (typeof value !== 'number') return value ?? '–';
  return format(v);
}
