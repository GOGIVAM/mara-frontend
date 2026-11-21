import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONTROL_POINTS } from './model.js';

/**
 * Jumeau numérique de l'essieu T17 (three.js).
 * Modèle procédural en attendant le modèle CAO fourni par la DMAT : corps,
 * portées de calage, roues à profil de boudin, fusées, boîtes d'essieu et rails.
 *
 * Props
 * - selectedPoint : id du repère actif (caméra recentrée dessus)
 * - highlightPart : clé de pièce mise en surbrillance
 * - animation : overview | focus | rotate | explode
 * - statuses : { [pointId]: 'conforme' | 'non_conforme' } (couleur des repères)
 * - onSelectPoint(id)
 */
export default function AxleViewer({ selectedPoint, highlightPart, animation = 'overview', statuses = {}, onSelectPoint }) {
  const hostRef = useRef(null);
  const labelRefs = useRef({});
  const stateRef = useRef(null);
  const propsRef = useRef({});
  const [failed, setFailed] = useState(false);

  propsRef.current = { selectedPoint, highlightPart, animation };

  useEffect(() => {
    const host = hostRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
    const HOME = { pos: new THREE.Vector3(1.7, 0.95, 2.1), target: new THREE.Vector3(0, 0, 0) };
    camera.position.copy(HOME.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 6;
    controls.target.copy(HOME.target);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a90, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-2, 1, -2);
    scene.add(rim);

    const disposables = [];
    const partMeshes = {};
    const material = (color, metalness = 0.6, roughness = 0.45) => {
      const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide });
      disposables.push(m);
      return m;
    };
    const add = (parent, part, geometry, mat, setup) => {
      disposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, mat);
      setup?.(mesh);
      parent.add(mesh);
      if (part) (partMeshes[part] ||= []).push(mesh);
      return mesh;
    };
    const alongX = (mesh, x) => { mesh.rotation.z = Math.PI / 2; mesh.position.x = x; };

    // Ensemble tournant : corps, portées, roues, fusées.
    const rotating = new THREE.Group();
    scene.add(rotating);

    add(rotating, 'corps', new THREE.CylinderGeometry(0.08, 0.08, 0.92, 48), material(0x9a9ca3), (m) => alongX(m, 0));
    [-1, 1].forEach((s) => {
      add(rotating, 'portee', new THREE.CylinderGeometry(0.095, 0.095, 0.16, 48), material(0xb7b9bf), (m) => alongX(m, s * 0.53));
      add(rotating, 'corps', new THREE.CylinderGeometry(0.075, 0.08, 0.06, 48), material(0x9a9ca3), (m) => alongX(m, s * 0.64));
      add(rotating, 'fusee', new THREE.CylinderGeometry(0.065, 0.065, 0.22, 48), material(0xd0d2d6, 0.8, 0.25), (m) => alongX(m, s * 0.78));
    });

    // Profil de roue (rayon, position axiale ; boudin côté intérieur).
    const profile = [
      [0.095, 0.07], [0.165, 0.07], [0.175, 0.02], [0.37, 0.02], [0.385, 0.0675], [0.428, 0.0675],
      [0.432, -0.025], [0.436, -0.04], [0.452, -0.05], [0.458, -0.0585], [0.452, -0.0675],
      [0.385, -0.0675], [0.37, -0.02], [0.175, -0.02], [0.165, -0.07], [0.095, -0.07], [0.095, 0.07],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    [-1, 1].forEach((s) => {
      add(rotating, 'roue', new THREE.LatheGeometry(profile, 96), material(0x6f7178, 0.7, 0.4), (m) => {
        m.rotation.z = -s * Math.PI / 2;
        m.position.x = s * 0.53;
      });
    });

    // Boîtes d'essieu (fixes, déplacées en vue éclatée).
    const boxes = [-1, 1].map((s) => {
      const g = new THREE.Group();
      add(g, 'boite', new THREE.CylinderGeometry(0.13, 0.13, 0.22, 48), material(0x3c3d42, 0.4, 0.6), (m) => alongX(m, 0));
      add(g, 'boite', new THREE.BoxGeometry(0.2, 0.08, 0.3), material(0x3c3d42, 0.4, 0.6), (m) => { m.position.y = 0.14; });
      add(g, 'boite', new THREE.CylinderGeometry(0.1, 0.1, 0.03, 48), material(0x55565c, 0.5, 0.5), (m) => alongX(m, s * 0.125));
      g.position.x = s * 0.78;
      g.userData.side = s;
      scene.add(g);
      return g;
    });

    // Rails (voie métrique) et sol.
    [-1, 1].forEach((s) => {
      add(scene, null, new THREE.BoxGeometry(0.07, 0.06, 3.2), material(0xa4a6ab, 0.8, 0.35), (m) => {
        m.position.set(s * 0.535, -0.43 - 0.03 - 0.005, 0);
      });
    });
    add(scene, null, new THREE.PlaneGeometry(6, 6), material(0xe8e7e7, 0, 1), (m) => {
      m.rotation.x = -Math.PI / 2;
      m.position.y = -0.5;
    });

    const tween = { from: null, to: null, t: 1 };
    const goTo = (pos, target) => {
      tween.from = { pos: camera.position.clone(), target: controls.target.clone() };
      tween.to = { pos, target };
      tween.t = 0;
    };

    stateRef.current = { HOME, goTo, boxes };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const clock = new THREE.Clock();
    const v = new THREE.Vector3();
    let explode = 0;
    let frame;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const { animation: anim, highlightPart: hp } = propsRef.current;

      if (anim === 'rotate') rotating.rotation.x += dt * 1.1;
      explode += ((anim === 'explode' ? 1 : 0) - explode) * Math.min(1, dt * 5);
      boxes.forEach((b) => { b.position.x = b.userData.side * (0.78 + explode * 0.3); });

      Object.entries(partMeshes).forEach(([part, meshes]) => {
        const on = part === hp;
        meshes.forEach((m) => {
          m.material.emissive.setHex(on ? 0xe10600 : 0x000000);
          m.material.emissiveIntensity = on ? 0.35 + 0.15 * Math.sin(clock.elapsedTime * 4) : 0;
        });
      });

      if (tween.t < 1) {
        tween.t = Math.min(1, tween.t + dt / 0.8);
        const e = 1 - (1 - tween.t) ** 3;
        camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
        controls.target.lerpVectors(tween.from.target, tween.to.target, e);
      }
      controls.update();
      renderer.render(scene, camera);

      // Repères HTML projetés sur la vue.
      const w = host.clientWidth;
      const h = host.clientHeight;
      CONTROL_POINTS.forEach((p) => {
        const el = labelRefs.current[p.id];
        if (!el) return;
        v.set(...p.position);
        if (p.part === 'boite') v.x += Math.sign(v.x) * explode * 0.3;
        v.project(camera);
        const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        el.style.display = visible ? '' : 'none';
        el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
      });
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, []);

  // Recentrage de la caméra lorsque l'étape ou le repère change.
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const p = CONTROL_POINTS.find((c) => c.id === selectedPoint);
    if (!p) { s.goTo(s.HOME.pos.clone(), s.HOME.target.clone()); return; }
    const target = new THREE.Vector3(...p.position);
    if (p.part === 'boite' && animation === 'explode') target.x += Math.sign(target.x) * 0.3;
    const dir = new THREE.Vector3(target.x * 0.6, target.y * 0.6 + 0.35, 1).normalize();
    s.goTo(target.clone().add(dir.multiplyScalar(1.05)), target);
  }, [selectedPoint, animation]);

  const resetView = () => {
    const s = stateRef.current;
    if (s) s.goTo(s.HOME.pos.clone(), s.HOME.target.clone());
  };

  if (failed) {
    return (
      <div className="viewer viewer-failed">
        <p className="muted">WebGL n'est pas disponible sur ce poste : la vue 3D ne peut pas être affichée.
          Le mode opératoire et la fiche de contrôle restent utilisables.</p>
      </div>
    );
  }

  return (
    <div className="viewer" ref={hostRef}>
      {CONTROL_POINTS.map((p) => (
        <button
          key={p.id}
          ref={(el) => { labelRefs.current[p.id] = el; }}
          className={`marker${selectedPoint === p.id ? ' marker-active' : ''}${statuses[p.id] ? ` marker-${statuses[p.id]}` : ''}`}
          title={p.label}
          onClick={() => onSelectPoint?.(p.id)}
        >
          {p.id.slice(1)}
        </button>
      ))}
      <button className="chip viewer-reset" onClick={resetView}>Vue d'ensemble</button>
    </div>
  );
}
