/**
 * Retours sonores du mode opératoire : signaux courts (Web Audio) et lecture
 * vocale des étapes (synthèse vocale du navigateur, voix française si disponible).
 */
let ctx = null;

const TONES = {
  next: [[660, 0.08]],
  done: [[660, 0.08], [880, 0.12]],
  alert: [[440, 0.15], [330, 0.15], [440, 0.15]],
  ko: [[300, 0.25]],
};

export function cue(kind = 'next') {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (const [freq, dur] of TONES[kind] || TONES.next) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.04;
    }
  } catch { /* audio indisponible : on reste silencieux */ }
}

export function speak(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const voice = synth.getVoices().find((v) => v.lang?.startsWith('fr'));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch { /* synthèse vocale indisponible */ }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* rien */ }
}
