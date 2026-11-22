import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SURBRILLANCE = 0xe10600;
const VUE = [1.5, 0.7, 2.3];
const TEINTES = { fusee: 0xc3cad3, portee_intermediaire: 0xa7b0bb, portee_calage: 0x8d97a3, corps: 0x7c8794 };

/**
 * Vue 3D d'un modèle glTF. Chaque maillage nommé « organe_g » ou « organe_d » devient
 * sélectionnable sous le nom « organe ». Fond transparent en mode RA pour laisser voir la caméra.
 * Un appui court sélectionne l'organe ; un glissé déplace la pièce dans le plan de l'écran.
 */
const Scene3D = forwardRef(function Scene3D({ modele, organe, eclate, transparent, onSelection, onCharge, onDeplace }, ref) {
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
    camera.position.set(...VUE);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5b6673, 2.1));
    const soleil = new THREE.DirectionalLight(0xffffff, 2.4);
    soleil.position.set(3, 5, 4);
    scene.add(soleil);

    const racine = new THREE.Group();
    const pieces = [];
    scene.add(racine);
    let actif = true;
    if (modele) {
      new GLTFLoader().load(modele, (gltf) => {
        if (!actif) return;
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          const nom = o.name.replace(/_[gd]$/, '');
          o.geometry.deleteAttribute('color');
          o.geometry.computeVertexNormals();
          o.material?.dispose();
          o.material = new THREE.MeshStandardMaterial({ color: TEINTES[nom] ?? 0x8d97a3, metalness: 0.5, roughness: 0.45 });
          o.userData = { organe: nom, ecart: 0, base: o.position.clone(), decalage: new THREE.Vector3() };
          pieces.push(o);
        });
        racine.add(gltf.scene);
        etat.current.onCharge?.(true);
      }, undefined, () => etat.current.onCharge?.(false));
    }

    const controles = new OrbitControls(camera, renderer.domElement);
    controles.enableDamping = true;
    controles.minDistance = 0.4;
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
    const viser = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      rayon.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    };
    // Glissé d'une pièce : plan face à la caméra passant par le point touché.
    const plan = new THREE.Plane();
    const point = new THREE.Vector3();
    let appui = null;
    const surAppui = (e) => {
      viser(e);
      const touche = rayon.intersectObjects(pieces)[0];
      appui = { x: e.clientX, y: e.clientY, piece: touche?.object, depart: null, glisse: false };
      if (!touche) return;
      etat.current.retour = false;
      controles.enabled = false;
      plan.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), touche.point);
      appui.depart = touche.point.clone();
      appui.decalage = touche.object.userData.decalage.clone();
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const surMouvement = (e) => {
      if (!appui?.piece) return;
      if (!appui.glisse && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) <= 6) return;
      appui.glisse = true;
      viser(e);
      if (!rayon.ray.intersectPlane(plan, point)) return;
      // Le déplacement est mesuré dans le repère du parent, qui porte l'échelle de la RA.
      const parent = appui.piece.parent;
      const avant = parent.worldToLocal(appui.depart.clone());
      const apres = parent.worldToLocal(point.clone());
      appui.piece.userData.decalage.copy(appui.decalage).add(apres.sub(avant));
    };
    const surRelache = (e) => {
      if (!appui) return;
      const { piece, glisse, x, y } = appui;
      appui = null;
      controles.enabled = !etat.current.face;
      if (glisse) { etat.current.onDeplace?.(true); return; }
      if (Math.hypot(e.clientX - x, e.clientY - y) > 6) return;
      etat.current.onSelection?.(piece?.userData.organe || null);
    };
    // En capture, pour passer avant la rotation de la vue quand l'appui tombe sur une pièce.
    renderer.domElement.addEventListener('pointerdown', surAppui, { capture: true });
    renderer.domElement.addEventListener('pointermove', surMouvement);
    renderer.domElement.addEventListener('pointerup', surRelache);
    renderer.domElement.addEventListener('pointercancel', surRelache);

    const horloge = new THREE.Clock();
    etat.current = { ...etat.current, pieces, racine, camera, controles, renderer, scene, ouverture: 0 };
    renderer.setAnimationLoop(() => {
      const dt = Math.min(horloge.getDelta(), 0.05);
      const s = etat.current;
      const pas = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1 - Math.exp(-dt * 7);
      s.ouverture += ((s.eclate ? 1 : 0) - s.ouverture) * pas;
      const pouls = 0.32 + 0.22 * Math.sin(performance.now() / 260);
      pieces.forEach((m) => {
        const { organe: o, ecart, base, decalage } = m.userData;
        if (s.retour) decalage.multiplyScalar(1 - pas);
        m.position.copy(base).add(decalage);
        m.position.x += ecart * s.ouverture;
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
      actif = false;
      observateur.disconnect();
      renderer.setAnimationLoop(null);
      controles.dispose();
      pieces.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modele]);

  useEffect(() => {
    Object.assign(etat.current, { organe, eclate, onSelection, onCharge, onDeplace });
  }, [organe, eclate, onSelection, onCharge, onDeplace]);

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
        camera.position.set(...(face ? [0, 0, 2.6] : VUE));
        controles.target.set(0, 0, 0);
      }
      racine.scale.setScalar(echelle);
      racine.position.set(x, y, 0);
    },
    /** Ramène toutes les pièces déplacées à leur place, avec une courte animation. */
    remettreEnPlace: () => {
      etat.current.retour = true;
      etat.current.onDeplace?.(false);
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
