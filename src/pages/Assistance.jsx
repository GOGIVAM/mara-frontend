import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

const TAILLE_MORCEAU = 16000;
const ICE = (() => {
  try { return JSON.parse(import.meta.env.VITE_ICE_SERVERS || '[]'); } catch { return []; }
})();

/**
 * Assistance à distance : audio, vidéo à débit limité et image figée annotée.
 * L'annotation porte sur une image figée, car le casque n'assure pas le suivi spatial.
 */
export default function Assistance() {
  const [salle, setSalle] = useState('');
  const [etat, setEtat] = useState('repos');
  const [erreur, setErreur] = useState('');
  const [audioSeul, setAudioSeul] = useState(false);
  const [imageFigee, setImageFigee] = useState(null);

  const videoLocale = useRef(null);
  const videoDistante = useRef(null);
  const canvas = useRef(null);
  const ws = useRef(null);
  const pc = useRef(null);
  const canal = useRef(null);
  const flux = useRef(null);
  const traits = useRef([]);
  const morceaux = useRef([]);
  const enTrait = useRef(null);

  const fermer = () => {
    try { ws.current?.send(JSON.stringify({ type: 'bye' })); } catch { /* déjà fermé */ }
    ws.current?.close();
    pc.current?.close();
    flux.current?.getTracks().forEach((t) => t.stop());
    ws.current = null; pc.current = null; canal.current = null; flux.current = null;
  };

  useEffect(() => fermer, []);

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
    const echelle = Math.min(1, 960 / video.videoWidth);
    c.width = Math.round(video.videoWidth * echelle);
    c.height = Math.round(video.videoHeight * echelle);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    const image = c.toDataURL('image/jpeg', 0.7);
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
  };

  const brancherCanal = (c) => {
    canal.current = c;
    c.onmessage = (e) => recevoir(e.data);
    c.onopen = () => setEtat('connecte');
  };

  const signal = (m) => ws.current?.send(JSON.stringify(m));

  const limiterDebit = () => {
    pc.current?.getSenders().filter((s) => s.track?.kind === 'video').forEach((s) => {
      const p = s.getParameters();
      p.encodings = p.encodings?.length ? p.encodings : [{}];
      p.encodings[0].maxBitrate = 300000;
      s.setParameters(p).catch(() => {});
    });
  };

  const rejoindre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEtat('connexion');
    try {
      const { ticket } = await api.ticketAssistance(salle);
      flux.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'environment', width: { ideal: 640 }, frameRate: { ideal: 10, max: 15 } },
      });
      videoLocale.current.srcObject = flux.current;

      pc.current = new RTCPeerConnection({ iceServers: ICE });
      flux.current.getTracks().forEach((t) => pc.current.addTrack(t, flux.current));
      pc.current.ontrack = (ev) => {
        videoDistante.current.srcObject = ev.streams[0];
        videoDistante.current.play().catch(() => {});
      };
      pc.current.onicecandidate = (ev) => { if (ev.candidate) signal({ type: 'candidate', candidate: ev.candidate }); };
      pc.current.ondatachannel = (ev) => brancherCanal(ev.channel);
      pc.current.onconnectionstatechange = () => {
        if (pc.current?.connectionState === 'connected') limiterDebit();
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
        if (m.type === 'peer_left') { setEtat('attente'); setImageFigee(null); }
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

        <div className={actif ? `assistance-videos${imageFigee ? ' assistance-reduite' : ''}` : 'assistance-cache'}>
          <figure>
            <video ref={videoDistante} autoPlay playsInline />
            <figcaption>Autre personne</figcaption>
          </figure>
          <figure>
            <video ref={videoLocale} autoPlay playsInline muted />
            <figcaption>Ma caméra</figcaption>
          </figure>
        </div>

        {actif && (
          <div className="etape-actions">
            <button className="chip" onClick={basculerAudio}>{audioSeul ? 'Rétablir la vidéo' : 'Audio seul'}</button>
            <button className="chip" disabled={etat !== 'connecte'}
              onClick={() => envoyer({ type: 'demande' })}>Figer l'image de l'autre</button>
            <button className="chip" disabled={etat !== 'connecte'} onClick={envoyerImage}>Figer ma caméra</button>
            <span className="etape-espace" />
            <button className="btn-ecart" onClick={quitter}>Quitter</button>
          </div>
        )}

      </section>
    </div>
  );
}
