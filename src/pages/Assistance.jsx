import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

const TAILLE_MORCEAU = 16000;
const ICE = (() => {
  try { return JSON.parse(import.meta.env.VITE_ICE_SERVERS || '[]'); } catch { return []; }
})();

// Réglages vidéo. « wifi » suppose deux appareils sur le même réseau local, sans passer par Internet.
const QUALITES = {
  reseau: { largeur: 640, hauteur: 480, images: 10, imagesMax: 15, debit: 300000 },
  wifi: { largeur: 1280, hauteur: 720, images: 30, imagesMax: 30, debit: 2500000 },
};
const CLE_QUALITE = 'mara.assistance.qualite';
const lireQualite = () => {
  try { return localStorage.getItem(CLE_QUALITE) === 'wifi' ? 'wifi' : 'reseau'; } catch { return 'reseau'; }
};

// Dessin en direct : un trait reste visible DUREE ms après son dernier point, puis s'efface en FONDU ms.
const DUREE = 3000;
const FONDU = 1000;
const COULEURS = { moi: '#ff2d20', autre: '#ffd400' };
const ENVOI_MIN_MS = 40;

/** Rectangle occupé par l'image dans l'élément vidéo (affichage sans recadrage). */
function cadre(video) {
  const l = video.clientWidth;
  const h = video.clientHeight;
  const vl = video.videoWidth || 4;
  const vh = video.videoHeight || 3;
  const e = Math.min(l / vl, h / vh);
  return { x: (l - vl * e) / 2, y: (h - vh * e) / 2, l: vl * e, h: vh * e };
}

/**
 * Assistance à distance : audio, vidéo, dessin en direct sur la vidéo et image figée annotée.
 * Le dessin en direct n'est pas ancré dans l'espace : il s'efface seul et suppose une caméra stable.
 * Pour une annotation durable, on fige l'image.
 */
export default function Assistance() {
  const [salle, setSalle] = useState('');
  const [etat, setEtat] = useState('repos');
  const [erreur, setErreur] = useState('');
  const [audioSeul, setAudioSeul] = useState(false);
  const [imageFigee, setImageFigee] = useState(null);
  const [qualite, setQualite] = useState(lireQualite);
  const [media, setMedia] = useState({ video: false, audio: false });

  const videoLocale = useRef(null);
  const videoDistante = useRef(null);
  const calqueLocal = useRef(null);
  const calqueDistant = useRef(null);
  const canvas = useRef(null);
  const ws = useRef(null);
  const pc = useRef(null);
  const canal = useRef(null);
  const flux = useRef(null);
  const traits = useRef([]);
  const morceaux = useRef([]);
  const enTrait = useRef(null);
  const direct = useRef(new Map());
  const traitDirect = useRef(null);
  const qualiteCourante = useRef(qualite);

  const fermer = () => {
    try { ws.current?.send(JSON.stringify({ type: 'bye' })); } catch { /* déjà fermé */ }
    ws.current?.close();
    pc.current?.close();
    flux.current?.getTracks().forEach((t) => t.stop());
    ws.current = null; pc.current = null; canal.current = null; flux.current = null;
    direct.current.clear();
  };

  useEffect(() => fermer, []);

  // ── Dessin en direct sur les vidéos ─────────────────────────────────────
  useEffect(() => {
    if (etat === 'repos') return undefined;
    let boucle;
    const peindre = (calque, video, surface, maintenant) => {
      if (!calque || !video) return;
      const ratio = window.devicePixelRatio || 1;
      const l = Math.round(video.clientWidth * ratio);
      const h = Math.round(video.clientHeight * ratio);
      if (calque.width !== l || calque.height !== h) { calque.width = l; calque.height = h; }
      const ctx = calque.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, l, h);
      const c = cadre(video);
      direct.current.forEach((t, cle) => {
        const age = maintenant - t.maj;
        if (age > DUREE + FONDU) { direct.current.delete(cle); return; }
        if (t.surface !== surface) return;
        ctx.globalAlpha = age < DUREE ? 1 : 1 - (age - DUREE) / FONDU;
        ctx.strokeStyle = COULEURS[t.origine];
        ctx.fillStyle = COULEURS[t.origine];
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const pts = t.points.map(([x, y]) => [c.x + x * c.l, c.y + y * c.h]);
        if (pts.length === 1) {
          // Pointage : un anneau et un point.
          ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 16, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 4, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    };
    const tour = () => {
      const maintenant = performance.now();
      peindre(calqueDistant.current, videoDistante.current, 'distante', maintenant);
      peindre(calqueLocal.current, videoLocale.current, 'locale', maintenant);
      boucle = requestAnimationFrame(tour);
    };
    boucle = requestAnimationFrame(tour);
    return () => cancelAnimationFrame(boucle);
  }, [etat]);

  /** Point de l'image vidéo sous le pointeur, en coordonnées 0 à 1 ; null hors de l'image. */
  const pointVideo = (e, video) => {
    const r = video.getBoundingClientRect();
    const c = cadre(video);
    const x = (e.clientX - r.left - c.x) / c.l;
    const y = (e.clientY - r.top - c.y) / c.h;
    return x < 0 || x > 1 || y < 0 || y > 1 ? null : [x, y];
  };

  const envoyerDirect = (t, force) => {
    const maintenant = performance.now();
    if (!force && maintenant - t.envoi < ENVOI_MIN_MS) return;
    t.envoi = maintenant;
    envoyer({ type: 'direct', id: t.id, surface: t.surface, points: t.points });
  };

  const debutDirect = (surface, video) => (e) => {
    if (etat !== 'connecte' || !video.current) return;
    const p = pointVideo(e, video.current);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, surface, points: [p], envoi: 0 };
    traitDirect.current = t;
    direct.current.set(`moi:${t.id}`, { origine: 'moi', surface, points: t.points, maj: performance.now() });
    envoyerDirect(t, true);
  };
  const suiteDirect = (video) => (e) => {
    const t = traitDirect.current;
    if (!t || !video.current) return;
    const p = pointVideo(e, video.current);
    if (!p) return;
    t.points.push(p);
    direct.current.set(`moi:${t.id}`, { origine: 'moi', surface: t.surface, points: t.points, maj: performance.now() });
    envoyerDirect(t, false);
  };
  const finDirect = () => {
    if (traitDirect.current) envoyerDirect(traitDirect.current, true);
    traitDirect.current = null;
  };

  // ── Qualité vidéo ───────────────────────────────────────────────────────
  const contraintesVideo = (q) => {
    const r = QUALITES[q];
    return { facingMode: 'environment', width: { ideal: r.largeur }, height: { ideal: r.hauteur }, frameRate: { ideal: r.images, max: r.imagesMax } };
  };

  const reglerDebit = (q) => {
    pc.current?.getSenders().filter((s) => s.track?.kind === 'video').forEach((s) => {
      const p = s.getParameters();
      p.encodings = p.encodings?.length ? p.encodings : [{}];
      p.encodings[0].maxBitrate = QUALITES[q].debit;
      s.setParameters(p).catch(() => {});
    });
  };

  /**
   * Rouvre la caméra avec la nouvelle résolution et remplace l'image envoyée sans couper la liaison.
   * applyConstraints arrête la caméra sur certains appareils pendant un appel : on ne l'utilise pas.
   * L'ancienne caméra est fermée d'abord, car beaucoup de tablettes ne l'ouvrent pas deux fois.
   */
  const rouvrirCamera = async (q) => {
    const ancienne = flux.current?.getVideoTracks()[0];
    if (!ancienne || !pc.current) return;
    const emetteur = pc.current.getSenders().find((s) => s.track === ancienne);
    const visible = ancienne.enabled;
    ancienne.stop();
    flux.current.removeTrack(ancienne);
    try {
      const nouvelle = (await navigator.mediaDevices.getUserMedia({ video: contraintesVideo(q), audio: false })).getVideoTracks()[0];
      nouvelle.enabled = visible;
      flux.current.addTrack(nouvelle);
      await emetteur?.replaceTrack(nouvelle);
      videoLocale.current.srcObject = flux.current;
    } catch {
      setErreur('La caméra n’a pas pu être rouverte. Quittez puis rejoignez la salle.');
    }
  };

  const changerQualite = async (q, propager = true) => {
    if (q === qualiteCourante.current) return;
    qualiteCourante.current = q;
    setQualite(q);
    try { localStorage.setItem(CLE_QUALITE, q); } catch { /* préférence non conservée */ }
    if (propager) envoyer({ type: 'qualite', valeur: q });
    await rouvrirCamera(q);
    reglerDebit(q);
  };

  // ── Image figée ─────────────────────────────────────────────────────────
  const dessiner = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const fond = c.fondImage;
    if (fond) ctx.drawImage(fond, 0, 0, c.width, c.height);
    ctx.strokeStyle = '#ff2d20';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    traits.current.forEach((points) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x * c.width, y * c.height) : ctx.moveTo(x * c.width, y * c.height)));
      ctx.stroke();
    });
  };

  useEffect(() => {
    if (!imageFigee || !canvas.current) return;
    const image = new Image();
    image.onload = () => {
      const c = canvas.current;
      if (!c) return;
      c.width = image.width;
      c.height = image.height;
      c.fondImage = image;
      dessiner();
    };
    image.src = imageFigee;
  }, [imageFigee]);

  const envoyerImage = () => {
    const video = videoLocale.current;
    if (!video?.videoWidth || canal.current?.readyState !== 'open') return;
    const c = document.createElement('canvas');
    const echelle = Math.min(1, 1280 / video.videoWidth);
    c.width = Math.round(video.videoWidth * echelle);
    c.height = Math.round(video.videoHeight * echelle);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    const image = c.toDataURL('image/jpeg', 0.8);
    traits.current = [];
    setImageFigee(image);
    for (let i = 0; i < image.length; i += TAILLE_MORCEAU) {
      canal.current.send(JSON.stringify({
        type: 'morceau', valeur: image.slice(i, i + TAILLE_MORCEAU), fin: i + TAILLE_MORCEAU >= image.length,
      }));
    }
  };

  const recevoir = (texte) => {
    const m = JSON.parse(texte);
    if (m.type === 'demande') envoyerImage();
    if (m.type === 'morceau') {
      morceaux.current.push(m.valeur);
      if (m.fin) {
        traits.current = [];
        setImageFigee(morceaux.current.join(''));
        morceaux.current = [];
      }
    }
    if (m.type === 'trait') { traits.current.push(m.points); dessiner(); }
    if (m.type === 'effacer') { traits.current = []; dessiner(); }
    if (m.type === 'reprendre') { traits.current = []; setImageFigee(null); }
    // Un trait dessiné sur « l'autre personne » chez l'émetteur se voit sur « ma caméra » ici.
    if (m.type === 'direct') {
      direct.current.set(`autre:${m.id}`, {
        origine: 'autre', surface: m.surface === 'distante' ? 'locale' : 'distante', points: m.points, maj: performance.now(),
      });
    }
    if (m.type === 'qualite' && QUALITES[m.valeur]) changerQualite(m.valeur, false);
  };

  const brancherCanal = (c) => {
    canal.current = c;
    c.onmessage = (e) => recevoir(e.data);
    c.onopen = () => setEtat('connecte');
  };

  const signal = (m) => ws.current?.send(JSON.stringify(m));

  /** Caméra et micro si possible ; sinon micro seul ; sinon aucun : on reçoit quand même l'autre personne. */
  const ouvrirMedia = async () => {
    const essais = [{ audio: true, video: contraintesVideo(qualiteCourante.current) }, { audio: true, video: false }];
    for (const contraintes of essais) {
      try {
        return await navigator.mediaDevices.getUserMedia(contraintes);
      } catch (err) {
        if (err.name === 'NotAllowedError') throw err;
      }
    }
    return new MediaStream();
  };

  const rejoindre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEtat('connexion');
    try {
      const { ticket } = await api.ticketAssistance(salle);
      flux.current = navigator.mediaDevices ? await ouvrirMedia() : new MediaStream();
      const aVideo = flux.current.getVideoTracks().length > 0;
      const aAudio = flux.current.getAudioTracks().length > 0;
      setMedia({ video: aVideo, audio: aAudio });
      videoLocale.current.srcObject = aVideo ? flux.current : null;

      pc.current = new RTCPeerConnection({ iceServers: ICE });
      flux.current.getTracks().forEach((t) => pc.current.addTrack(t, flux.current));
      pc.current.ontrack = (ev) => {
        videoDistante.current.srcObject = ev.streams[0] || new MediaStream([ev.track]);
        videoDistante.current.play().catch(() => {});
      };
      pc.current.onicecandidate = (ev) => { if (ev.candidate) signal({ type: 'candidate', candidate: ev.candidate }); };
      pc.current.ondatachannel = (ev) => brancherCanal(ev.channel);
      pc.current.onconnectionstatechange = () => {
        if (pc.current?.connectionState === 'connected') reglerDebit(qualiteCourante.current);
        if (pc.current?.connectionState === 'failed') {
          setErreur('Liaison impossible sur ce réseau. Envoyez plutôt une photo avec la visite.');
        }
      };

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws.current = new WebSocket(`${proto}://${window.location.host}/ws/signaling/${encodeURIComponent(salle)}`);
      ws.current.onopen = () => signal({ type: 'auth', token: ticket });
      ws.current.onclose = (ev) => {
        if (ev.code === 4401) setErreur('Accès à la salle refusé.');
        if (ev.code === 4000) setErreur('Cette salle est déjà occupée.');
      };
      // Les messages sont traités un par un, dans l'ordre d'arrivée. Un candidat réseau
      // reçu avant la description distante attend, sinon la liaison échoue au hasard.
      let file = Promise.resolve();
      let candidats = [];
      const appliquerDistante = async (sdp) => {
        await pc.current.setRemoteDescription(sdp);
        const enAttente = candidats;
        candidats = [];
        await Promise.all(enAttente.map((c) => pc.current.addIceCandidate(c).catch(() => {})));
      };
      const traiter = async (m) => {
        if (!pc.current) return;
        if (m.type === 'ready') setEtat('attente');
        if (m.type === 'peer_joined') {
          brancherCanal(pc.current.createDataChannel('annotations'));
          // Sans caméra ou sans micro, on demande quand même à recevoir ceux de l'autre personne.
          if (!aVideo) pc.current.addTransceiver('video', { direction: 'recvonly' });
          if (!aAudio) pc.current.addTransceiver('audio', { direction: 'recvonly' });
          await pc.current.setLocalDescription(await pc.current.createOffer());
          signal({ type: 'offer', sdp: pc.current.localDescription });
        }
        if (m.type === 'offer') {
          await appliquerDistante(m.sdp);
          await pc.current.setLocalDescription(await pc.current.createAnswer());
          signal({ type: 'answer', sdp: pc.current.localDescription });
        }
        if (m.type === 'answer') await appliquerDistante(m.sdp);
        if (m.type === 'candidate') {
          if (pc.current.remoteDescription) await pc.current.addIceCandidate(m.candidate).catch(() => {});
          else candidats.push(m.candidate);
        }
        if (m.type === 'peer_left') { setEtat('attente'); setImageFigee(null); direct.current.clear(); }
      };
      ws.current.onmessage = (ev) => {
        const message = JSON.parse(ev.data);
        file = file.then(() => traiter(message)).catch(() => setErreur('La liaison a échoué. Quittez puis rejoignez la salle.'));
      };
    } catch (err) {
      fermer();
      setEtat('repos');
      setErreur(err.name === 'NotAllowedError' ? 'Autorisez la caméra et le micro.' : err.message);
    }
  };

  const quitter = () => { fermer(); setEtat('repos'); setImageFigee(null); };

  const basculerAudio = () => {
    const suivant = !audioSeul;
    flux.current?.getVideoTracks().forEach((t) => { t.enabled = !suivant; });
    setAudioSeul(suivant);
  };

  const envoyer = (m) => { if (canal.current?.readyState === 'open') canal.current.send(JSON.stringify(m)); };
  const position = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const debutTrait = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    enTrait.current = [position(e)];
    traits.current.push(enTrait.current);
  };
  const suiteTrait = (e) => {
    if (!enTrait.current) return;
    enTrait.current.push(position(e));
    dessiner();
  };
  const finTrait = () => {
    if (enTrait.current) envoyer({ type: 'trait', points: enTrait.current });
    enTrait.current = null;
  };

  const actif = etat !== 'repos';
  const connecte = etat === 'connecte';

  return (
    <div className="page">
      <section className="card panel assistance">
        <header className="panel-head">
          <h3>Assistance à distance</h3>
          <span className="muted" role="status">
            {{ repos: 'Non connecté', connexion: 'Connexion…', attente: "En attente de l'autre personne", connecte: 'Connecté' }[etat]}
          </span>
        </header>

        {etat === 'attente' && <div className="radar" aria-hidden="true"><i /><i /><i /></div>}

        {!actif && (
          <form className="assistance-salle" onSubmit={rejoindre}>
            <label htmlFor="salle">Code de la salle</label>
            <input id="salle" required pattern="[A-Za-z0-9_\-]{1,64}" value={salle} autoComplete="off"
              placeholder="Exemple : essieu-T17-0001" onChange={(e) => setSalle(e.target.value)} />
            <button className="primary-btn">Rejoindre</button>
          </form>
        )}
        {erreur && <p className="scan-error" role="alert">{erreur}</p>}

        {imageFigee && (
          <div className="assistance-figee">
            <p className="muted">Dessinez sur l'image : le trait apparaît chez l'autre personne.</p>
            <canvas ref={canvas} aria-label="Image figée à annoter" onPointerDown={debutTrait}
              onPointerMove={suiteTrait} onPointerUp={finTrait} onPointerCancel={finTrait} />
            <div className="etape-actions">
              <button className="chip" onClick={() => { traits.current = []; dessiner(); envoyer({ type: 'effacer' }); }}>Effacer</button>
              <button className="chip" onClick={() => { traits.current = []; setImageFigee(null); envoyer({ type: 'reprendre' }); }}>Fermer l'image</button>
            </div>
          </div>
        )}

        {connecte && !imageFigee && (
          <p className="muted assistance-aide">
            Dessinez ou touchez la vidéo pour pointer : le trait apparaît en direct chez l'autre personne et s'efface
            après quelques secondes. Pour annoter durablement, figez l'image.
          </p>
        )}

        <div className={actif ? `assistance-videos${imageFigee ? ' assistance-reduite' : ''}` : 'assistance-cache'}>
          <figure>
            <div className="video-annotee">
              <video ref={videoDistante} autoPlay playsInline />
              <canvas ref={calqueDistant} className="calque-direct" aria-label="Dessiner sur la vidéo de l'autre personne"
                onPointerDown={debutDirect('distante', videoDistante)} onPointerMove={suiteDirect(videoDistante)}
                onPointerUp={finDirect} onPointerCancel={finDirect} />
            </div>
            <figcaption>Autre personne</figcaption>
          </figure>
          <figure>
            <div className="video-annotee">
              <video ref={videoLocale} autoPlay playsInline muted />
              <canvas ref={calqueLocal} className="calque-direct" aria-label="Dessiner sur ma caméra"
                onPointerDown={debutDirect('locale', videoLocale)} onPointerMove={suiteDirect(videoLocale)}
                onPointerUp={finDirect} onPointerCancel={finDirect} />
            </div>
            <figcaption>
              {media.video ? 'Ma caméra' : `Sans caméra${media.audio ? ', micro actif' : ', ni micro'} : vous voyez et entendez l'autre personne`}
            </figcaption>
          </figure>
        </div>

        {actif && (
          <div className="etape-actions">
            <button className="chip" disabled={!media.video} onClick={basculerAudio}>{audioSeul ? 'Rétablir la vidéo' : 'Audio seul'}</button>
            <button className="chip" aria-pressed={qualite === 'wifi'}
              onClick={() => changerQualite(qualite === 'wifi' ? 'reseau' : 'wifi')}>
              {qualite === 'wifi' ? 'Qualité haute (Wi-Fi local) active' : 'Wi-Fi local : qualité haute'}
            </button>
            <button className="chip" disabled={!connecte}
              onClick={() => envoyer({ type: 'demande' })}>Figer l'image de l'autre</button>
            <button className="chip" disabled={!connecte || !media.video} onClick={envoyerImage}>Figer ma caméra</button>
            <span className="etape-espace" />
            <button className="btn-ecart" onClick={quitter}>Quitter</button>
          </div>
        )}

      </section>
    </div>
  );
}
