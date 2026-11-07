import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const SURBRILLANCE = 0xe10600;

/** Vue 3D, vide tant qu'aucun modèle n'est chargé. Le fond devient transparent en mode RA pour laisser voir la caméra. */
const Scene3D = forwardRef(function Scene3D({ organe, eclate, transparent, onSelection }, ref) {
  const hote = useRef(null);
  const etat = useRef({});

  useEffect(() => {
    const noeud = hote.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    noeud.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 50);
    camera.position.set(2.7, 1.5, 4.5);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5b6673, 2.1));
    const soleil = new THREE.DirectionalLight(0xffffff, 2.4);
    soleil.position.set(3, 5, 4);
    scene.add(soleil);

    const racine = new THREE.Group();
    const pieces = [];
    scene.add(racine);

    const controles = new OrbitControls(camera, renderer.domElement);
    controles.enableDamping = true;
    controles.minDistance = 1.2;
    controles.maxDistance = 12;
    controles.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controles.autoRotateSpeed = 0.9;
    controles.addEventListener('start', () => { controles.autoRotate = false; });

    const dimensionner = () => {
      const { clientWidth: l, clientHeight: h } = noeud;
      if (!l || !h || renderer.xr.isPresenting) return;
      renderer.setSize(l, h, true);
      camera.aspect = l / h;
      camera.updateProjectionMatrix();
    };
    const observateur = new ResizeObserver(dimensionner);
    observateur.observe(noeud);
    dimensionner();

    const rayon = new THREE.Raycaster();
    let appui = null;
    const surAppui = (e) => { appui = [e.clientX, e.clientY]; };
    const surRelache = (e) => {
      if (!appui || Math.hypot(e.clientX - appui[0], e.clientY - appui[1]) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      rayon.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const touche = rayon.intersectObjects(pieces)[0];
      etat.current.onSelection?.(touche?.object.userData.organe || null);
    };
    renderer.domElement.addEventListener('pointerdown', surAppui);
    renderer.domElement.addEventListener('pointerup', surRelache);

    const horloge = new THREE.Clock();
    etat.current = { ...etat.current, pieces, racine, camera, controles, renderer, scene, ouverture: 0 };
    renderer.setAnimationLoop(() => {
      const dt = Math.min(horloge.getDelta(), 0.05);
      const s = etat.current;
      const pas = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1 - Math.exp(-dt * 7);
      s.ouverture += ((s.eclate ? 1 : 0) - s.ouverture) * pas;
      const pouls = 0.32 + 0.22 * Math.sin(performance.now() / 260);
      pieces.forEach((m) => {
        const { organe: o, ecart, xBase } = m.userData;
        m.position.x = xBase + ecart * s.ouverture;
        const choisi = s.organe === o;
        m.material.emissive.setHex(choisi ? SURBRILLANCE : 0x000000);
        m.material.emissiveIntensity = choisi ? pouls : 0;
        const estompe = s.organe && !choisi;
        m.material.transparent = Boolean(estompe);
        m.material.opacity += ((estompe ? 0.28 : 1) - m.material.opacity) * pas;
      });
      if (!renderer.xr.isPresenting) controles.update();
      renderer.render(scene, camera);
    });

    return () => {
      observateur.disconnect();
      renderer.setAnimationLoop(null);
      controles.dispose();
      pieces.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => { Object.assign(etat.current, { organe, eclate, onSelection }); }, [organe, eclate, onSelection]);

  useImperativeHandle(ref, () => ({
    /** Échelle et position du modèle sur l'image de la caméra. */
    placer: ({ echelle, x, y, face }) => {
      const { racine, camera, controles } = etat.current;
      if (!racine) return;
      // En RA, la maquette est vue de face pour pouvoir la caler sur l'essieu filmé.
      if (face !== etat.current.face) {
        etat.current.face = face;
        controles.autoRotate = false;
        controles.enabled = !face;
        camera.position.set(...(face ? [0, 0, 4.6] : [2.7, 1.5, 4.5]));
        controles.target.set(0, 0, 0);
      }
      racine.scale.setScalar(echelle);
      racine.position.set(x, y, 0);
    },
    /** RA ancrée au sol, sur les appareils compatibles WebXR/ARCore. */
    lancerWebXR: async (surFin) => {
      const { renderer, racine } = etat.current;
      const session = await navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['local-floor'], domOverlay: { root: document.body },
      });
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      racine.scale.setScalar(0.5);
      racine.position.set(0, 0.6, -1.4);
      session.addEventListener('end', () => { racine.scale.setScalar(1); racine.position.set(0, 0, 0); surFin?.(); });
    },
  }), []);

  return <div ref={hote} className={`scene3d${transparent ? ' scene3d-transparente' : ''}`} />;
});

export default Scene3D;
