import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';
import { Cube, Offline, Sparkle } from '../components/Icons.jsx';
import { SAFETY_CLASS, classLabel, percent } from '../lib/format.js';

/**
 * Reconnaissance d'équipement : capture caméra, envoi de la frame base64 à
 * POST /api/inference (proxy FastAPI), affichage des détections et des boîtes
 * englobantes, repli marqueur QR / sélection manuelle si le service est indisponible.
 */
export default function Scan() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [sessionId] = useState(() => `console-${Math.random().toString(36).slice(2, 10)}`);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [equipements, setEquipements] = useState([]);
  const [manualId, setManualId] = useState('');
  const [gammes, setGammes] = useState([]);

  useEffect(() => {
    api.equipements({ statut: 'actif' }).then(setEquipements).catch(() => {});
    api.inferenceHealth().then(setHealth).catch(() => setHealth({ available: false }));
    return () => stopCamera();
  }, []);

  const best = result?.detections?.[0];

  useEffect(() => {
    const classe = best?.class || equipements.find((e) => e.id === manualId)?.classe;
    if (!classe) { setGammes([]); return; }
    api.gammesByClass(classe).then(setGammes).catch(() => setGammes([]));
  }, [best, manualId, equipements]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError("Accès à la caméra refusé. Autorisez la caméra ou sélectionnez l'équipement manuellement.");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    stream?.getTracks?.().forEach((t) => t.stop());
    setStreaming(false);
  };

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setBusy(true); setError(''); setResult(null);

    // Redimensionnement 640 px + compression JPEG : limite le temps de transfert.
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const scale = 640 / Math.max(video.videoWidth, 1);
    canvas.width = 640;
    canvas.height = Math.round(video.videoHeight * scale) || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

    try {
      setResult(await api.infer(sessionId, imageBase64));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Boîte englobante FastAPI : coordonnées normalisées ou en pixels de la frame 640.
  const boxStyle = (b) => {
    const norm = b.x2 <= 1.5 ? 1 : 640;
    const x1 = b.x1 / norm, x2 = b.x2 / norm, y1 = b.y1 / norm, y2 = b.y2 / norm;
    return {
      inset: 'auto',
      left: `${x1 * 100}%`, top: `${y1 * 100}%`,
      width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%`,
    };
  };

  return (
    <div className="page two-col-wide">
      <section className="card panel">
        <header className="panel-head">
          <h3>Reconnaissance d'équipement</h3>
          <span className={health && !health.available ? 'kpi-non_atteint' : 'muted'}>
            {health
              ? health.available ? 'Service d\'inférence disponible' : 'Service d\'inférence indisponible, repli marqueur QR'
              : 'Vérification du service…'}
          </span>
        </header>

        <div className="viewfinder">
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} hidden />
          {!streaming && (
            <div className="viewfinder-idle">
              <Cube size={28} />
              <p>Activez la caméra pour cadrer l'équipement à identifier.</p>
            </div>
          )}
          {(result?.detections || []).map((d, i) => (
            <div key={i} className="viewfinder-box" style={boxStyle(d.boundingBox)}>
              <span>{classLabel(d.class)} · {percent(d.scoreFinal)}</span>
            </div>
          ))}
        </div>

        <div className="scan-actions">
          {streaming
            ? <button className="primary-btn" onClick={capture} disabled={busy}>
                {busy ? 'Analyse en cours…' : "Identifier l'équipement"}
              </button>
            : <button className="primary-btn" onClick={startCamera}>Activer la caméra</button>}
          {streaming && <button className="chip" onClick={stopCamera}>Arrêter</button>}
          <span className="muted">Session {sessionId}</span>
        </div>

        {error && <p className="scan-error"><Offline size={15} /> {error}</p>}

        {result && (
          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr><th>Classe</th><th>Score final</th><th>Détection</th><th>Classification</th><th>Lissé</th><th>Vuforia</th></tr>
            </thead>
            <tbody>
              {(result.detections || []).map((d, i) => (
                <tr key={i}>
                  <td>{classLabel(d.class)}</td>
                  <td><span className={`score${d.scoreFinal >= 0.7 ? ' score-ok' : ''}`}>{percent(d.scoreFinal)}</span></td>
                  <td>{percent(d.scoreDet)}</td>
                  <td>{percent(d.scoreCls)}</td>
                  <td>{percent(d.scoreSmoothed)}</td>
                  <td>{d.preActivateVuforia ? 'Pré-activé' : ''}</td>
                </tr>
              ))}
              {!(result.detections || []).length && (
                <tr><td colSpan={6} className="muted">Aucune détection : utilisez le marqueur QR ou la sélection manuelle.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <aside className="card panel">
        <header className="panel-head"><h3>Résultat</h3></header>

        {result && (
          <div className="detail">
            <p className="detail-title">
              {best ? classLabel(best.class) : 'Équipement non identifié'}
            </p>
            <dl>
              <div><dt>Latence d'inférence</dt><dd>{Math.round(result.inferenceMs || 0)} ms</dd></div>
              <div><dt>Version du pipeline</dt><dd>{result.pipelineVersion}</dd></div>
              <div><dt>Repli marqueur QR</dt><dd>{result.fallbackQrRecommended ? 'Recommandé' : 'Non nécessaire'}</dd></div>
              <div><dt>Session</dt><dd>{result.sessionId}</dd></div>
            </dl>
          </div>
        )}

        <div className="manual-select">
          <h4>Sélection manuelle (repli)</h4>
          <select value={manualId} onChange={(e) => setManualId(e.target.value)}>
            <option value="">Choisir un équipement…</option>
            {equipements.map((e) => (
              <option key={e.id} value={e.id}>{e.code} · {e.designation}</option>
            ))}
          </select>
          {manualId && (
            <p className="muted">
              Marqueur Vuforia : {equipements.find((e) => e.id === manualId)?.marqueur || 'non défini'}
            </p>
          )}
        </div>

        <h4>Gammes de la classe reconnue</h4>
        {gammes.map((g) => (
          <div key={g.id} className="detail" style={{ marginBottom: 14 }}>
            <p className="detail-title">{g.code} · {g.titre}</p>
            <p className="muted">v{g.version} · {g.direction} · {(g.etapes || []).length} étapes</p>
            <ol className="steps">
              {(g.etapes || []).slice(0, 4).map((s) => (
                <li key={s.id} className={`step step-${SAFETY_CLASS[s.niveauSecurite] || 'vert'}`}>
                  <span className="step-order">{String(s.ordreIndex).padStart(2, '0')}</span>
                  <span className="step-body"><strong>{s.description}</strong></span>
                </li>
              ))}
            </ol>
            {(g.etapes || []).length > 4 && (
              <p className="muted"><Sparkle size={13} /> {(g.etapes || []).length - 4} étapes supplémentaires dans l'écran Gammes.</p>
            )}
          </div>
        ))}
        {!gammes.length && <p className="muted">Aucune gamme rattachée pour l'instant.</p>}
      </aside>
    </div>
  );
}
