import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { nomenclature } from '../lib/maquettes.js';

const SURBRILLANCE = new THREE.Color(0xe10600);
const NOIR = new THREE.Color(0x000000);
const DIRECTIONS = {
  face: [[0, 0, 1], [0, 1, 0]], arriere: [[0, 0, -1], [0, 1, 0]], gauche: [[-1, 0, 0], [0, 1, 0]],
  droite: [[1, 0, 0], [0, 1, 0]], dessus: [[0, 1, 0], [0, 0, -1]], dessous: [[0, -1, 0], [0, 0, 1]],
  trois_quarts: [[1, 0.65, 1.35], [0, 1, 0]],
};
const AXES_COUPE = { x: [-1, 0, 0], y: [0, -1, 0], z: [0, 0, -1] };
const reduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const v3 = (a) => new THREE.Vector3(...(a || [0, 0, 0]));

/** Boîte englobante des maillages visibles d'un objet. */
function boiteVisible(objet) {
  const b = new THREE.Box3();
  objet.updateWorldMatrix(true, true);
  objet.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.decor) return;
    let p = o.parent;
    while (p) { if (!p.visible) return; p = p.parent; }
    b.expandByObject(o);
  });
  return b;
}

/** Déplacement de dépose : celui du manifeste, sinon le long de l'éclaté, sinon vers le haut. */
function vecteurDepose(man, taille) {
  if (man.depose) return v3(man.depose);
  if (man.fixation) return v3(man.fixation.axe).multiplyScalar(man.fixation.degagement + 0.06);
  if (man.eclate) return v3(man.eclate.axe).normalize().multiplyScalar(Math.max(man.eclate.distance * 1.6, 0.2));
  return new THREE.Vector3(0, Math.max(0.2, taille * 0.8), 0);
}

/**
 * Maquette 3D pilotée par le catalogue. Les matériaux et normales du GLB sont conservés ;
 * la surbrillance porte sur une copie par maillage. Une seule instance sert au plan 2D,
 * à l'atelier 3D, à la caméra et à la RA suivie : la sélection et l'état ne se perdent pas.
 */
const Scene3D = forwardRef(function Scene3D(props, ref) {
  const hote = useRef(null);
  const etiquettes = useRef(null);
  const s = useRef({});
  s.current.props = props;

  useEffect(() => {
    const { glb, manifeste } = props;
    if (!glb || !manifeste) return undefined;
    const noeud = hote.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    renderer.xr.enabled = true;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', `Maquette 3D : ${manifeste.titre}`);
    noeud.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const perspective = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5b6673, 2.0));
    const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
    soleil.position.set(3, 6, 4);
    scene.add(soleil);
    const contre = new THREE.DirectionalLight(0xffffff, 0.8);
    contre.position.set(-4, 2, -3);
    scene.add(contre);

    const racine = new THREE.Group();
    scene.add(racine);
    const atelier = new THREE.Group();
    atelier.visible = false;
    scene.add(atelier);
    const plan = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    const st = s.current;
    Object.assign(st, {
      renderer, scene, perspective, ortho, camera: perspective, racine, atelier, plan, pieces: new Map(),
      maillages: [], objet: new THREE.Vector3(), centre: new THREE.Vector3(), rayon: 1, vol: null,
      ecartEnvoye: null, suivi: null, xr: null, charge: false, etatsPrec: {},
    });

    const controles = new OrbitControls(perspective, renderer.domElement);
    controles.enableDamping = true;
    controles.screenSpacePanning = true;
    controles.listenToKeyEvents(renderer.domElement);
    controles.keyPanSpeed = 14;
    st.controles = controles;

    let actif = true;
    new GLTFLoader().parse(glb.slice(0), '', (gltf) => {
      if (!actif) return;
      const modele = gltf.scene;
      const boite = new THREE.Box3().setFromObject(modele);
      boite.getCenter(st.centre);
      st.rayon = Math.max(boite.getSize(new THREE.Vector3()).length() / 2, 0.05);
      st.bas = boite.min.y - st.centre.y;
      modele.position.sub(st.centre);
      racine.add(modele);

      const compat = manifeste.compat;
      const noeuds = new Set();
      modele.traverse((o) => { if (o.name) noeuds.add(o.name); });
      for (const man of manifeste.pieces) {
        const obj = modele.getObjectByName(man.noeud);
        if (!obj) continue;
        const taille = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).length() / 2;
        st.pieces.set(man.id, {
          obj, man, taille, depose: vecteurDepose(man, taille),
          ref: { p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone() },
          off: new THREE.Vector3(), ang: 0, libre: new THREE.Vector3(), retour: false,
        });
        obj.userData.piece = man.id;
      }
      modele.traverse((o) => {
        if (!o.isMesh) return;
        let p = o;
        while (p && !p.userData.piece) p = p.parent;
        const id = p?.userData.piece;
        const man = id && st.pieces.get(id)?.man;
        if (compat) {
          // Adaptation limitée de l'ancienne maquette de l'axe : normales et teintes recalculées.
          o.geometry.deleteAttribute('color');
          o.geometry.computeVertexNormals();
          o.material = new THREE.MeshStandardMaterial({
            color: compat.teintes?.[man?.organe] || '#8d97a3', metalness: 0.5, roughness: 0.45,
          });
        } else {
          o.material = o.material.clone();
        }
        o.material.clippingPlanes = [];
        o.userData.base = { opacite: o.material.opacity, transparent: o.material.transparent, cote: o.material.side };
        o.userData.id = id;
        const contour = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28),
          new THREE.LineBasicMaterial({ color: 0x1b2430 }));
        contour.visible = false;
        contour.userData.decor = true;
        o.add(contour);
        o.userData.contour = contour;
        o.userData.planMat = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        st.maillages.push(o);
      });

      // Atelier léger : sol, quadrillage et fond, à l'échelle de la maquette.
      const r = st.rayon;
      const sol = new THREE.Mesh(new THREE.PlaneGeometry(r * 8, r * 8), new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.95 }));
      sol.rotation.x = -Math.PI / 2;
      sol.position.y = st.bas - 0.002;
      const grille = new THREE.GridHelper(r * 8, 32, 0x9aa3ad, 0xc3c9d0);
      grille.position.y = st.bas;
      const mur = new THREE.Mesh(new THREE.PlaneGeometry(r * 8, r * 3), new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: 1 }));
      mur.position.set(0, st.bas + r * 1.5, -r * 3);
      [sol, grille, mur].forEach((o) => { o.userData.decor = true; atelier.add(o); });

      construireEtiquettes();
      st.charge = true;
      allerVue(manifeste.vueInitiale || 'trois_quarts', true);
      st.props.onCharge?.({ ok: true, noeuds });
    }, (e) => st.props.onCharge?.({ ok: false, erreur: String(e?.message || e) }));

    // ── Étiquettes de repères (plan 2D, caméra en repères seuls) ──────────────
    function construireEtiquettes() {
      const zone = etiquettes.current;
      if (!zone) return;
      zone.replaceChildren();
      st.etiquettes = nomenclature(manifeste).map((g) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'repere';
        b.textContent = g.numero;
        b.title = g.nom;
        b.setAttribute('aria-label', `Repère ${g.numero} : ${g.nom}`);
        b.addEventListener('click', () => st.props.onSelection?.(g.organe));
        zone.appendChild(b);
        return { ...g, el: b };
      });
    }

    // ── Caméras et vues ───────────────────────────────────────────────────────
    function cadrer() {
      const b = boiteVisible(racine);
      if (b.isEmpty()) return { c: new THREE.Vector3(), r: st.rayon };
      return { c: b.getCenter(new THREE.Vector3()), r: Math.max(b.getSize(new THREE.Vector3()).length() / 2, 0.03) };
    }

    function allerVue(nom, immediat = false) {
      const [d, haut] = DIRECTIONS[nom] || DIRECTIONS.trois_quarts;
      const { c, r } = cadrer();
      const dir = v3(d).normalize();
      const cam = st.camera;
      const dist = cam.isPerspectiveCamera ? (r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.08 : r * 4;
      const cible = { pos: c.clone().add(dir.multiplyScalar(dist)), tgt: c, haut: v3(haut), zoom: 1 };
      cam.near = Math.max(dist / 200, 0.005);
      cam.far = dist + r * 20;
      ajusterOrtho(r * 1.15);
      if (immediat || reduit()) {
        cam.up.copy(cible.haut);
        cam.position.copy(cible.pos);
        controles.target.copy(cible.tgt);
        cam.zoom = 1;
        cam.updateProjectionMatrix();
        st.vol = null;
      } else {
        st.vol = { de: { pos: cam.position.clone(), tgt: controles.target.clone(), zoom: cam.zoom }, a: cible, t: 0 };
        cam.up.copy(cible.haut);
      }
      st.vueCourante = nom;
    }

    function ajusterOrtho(demi) {
      const { clientWidth: l, clientHeight: h } = noeud;
      const asp = l && h ? l / h : 1;
      st.demiOrtho = demi || st.demiOrtho || 1;
      ortho.left = -st.demiOrtho * asp;
      ortho.right = st.demiOrtho * asp;
      ortho.top = st.demiOrtho;
      ortho.bottom = -st.demiOrtho;
      ortho.updateProjectionMatrix();
    }

    function changerCamera(orthographique) {
      const nouvelle = orthographique ? ortho : perspective;
      if (nouvelle === st.camera) return;
      nouvelle.position.copy(st.camera.position);
      nouvelle.up.copy(st.camera.up);
      st.camera = nouvelle;
      controles.object = nouvelle;
      allerVue(st.vueCourante || 'trois_quarts', true);
    }
    st.allerVue = allerVue;
    st.changerCamera = changerCamera;

    const dimensionner = () => {
      const { clientWidth: l, clientHeight: h } = noeud;
      if (!l || !h || renderer.xr.isPresenting) return;
      renderer.setSize(l, h, true);
      perspective.aspect = l / h;
      perspective.updateProjectionMatrix();
      ajusterOrtho();
    };
    const observateur = new ResizeObserver(dimensionner);
    observateur.observe(noeud);
    dimensionner();

    // ── Sélection, glissé de pièce ou d'objet, aimantation ────────────────────
    const rayon = new THREE.Raycaster();
    const viser = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      rayon.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), st.camera);
    };
    const toucher = () => rayon.intersectObjects(st.maillages.filter((m) => m.visible && estVisible(m)), false)
      .find((h) => !st.props.coupe?.actif || st.plan.distanceToPoint(h.point) >= 0);
    const pieceSelectionnable = (mesh) => {
      let o = mesh;
      while (o) {
        const id = o.userData.piece;
        if (id && st.pieces.get(id)?.man.selectionnable !== false) return id;
        o = o.parent;
      }
      return null;
    };
    const planGlisse = new THREE.Plane();
    const point = new THREE.Vector3();
    let appui = null;

    const surAppui = (e) => {
      if (renderer.xr.isPresenting || !st.charge) return;
      viser(e);
      const touche = toucher();
      const mode = st.props.manipulation;
      appui = { x: e.clientX, y: e.clientY, id: touche ? pieceSelectionnable(touche.object) : null, glisse: false };
      if (!touche || mode === 'vue') return;
      if (mode === 'piece' && !appui.id) return;
      controles.enabled = false;
      planGlisse.setFromNormalAndCoplanarPoint(st.camera.getWorldDirection(new THREE.Vector3()), touche.point);
      appui.depart = touche.point.clone();
      appui.mode = mode;
      if (mode === 'piece') {
        const pc = st.pieces.get(appui.id);
        pc.retour = false;
        appui.libre = pc.libre.clone();
      } else {
        appui.objet = st.objet.clone();
      }
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const surMouvement = (e) => {
      if (!appui?.depart) return;
      if (!appui.glisse && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) <= 6) return;
      appui.glisse = true;
      viser(e);
      if (!rayon.ray.intersectPlane(planGlisse, point)) return;
      if (appui.mode === 'piece') {
        const pc = st.pieces.get(appui.id);
        const parent = pc.obj.parent;
        const avant = parent.worldToLocal(appui.depart.clone());
        const apres = parent.worldToLocal(point.clone());
        pc.libre.copy(appui.libre).add(apres.sub(avant));
      } else {
        const avant = racine.parent.worldToLocal(appui.depart.clone());
        const apres = racine.parent.worldToLocal(point.clone());
        st.objet.copy(appui.objet).add(apres.sub(avant));
      }
    };
    const surRelache = (e) => {
      if (!appui) return;
      const a = appui;
      appui = null;
      controles.enabled = st.props.affichage !== 'camera';
      if (a.glisse && a.mode === 'piece') {
        const pc = st.pieces.get(a.id);
        // Distance à la pose assemblée, dans le repère du monde.
        const decal = pc.off.clone().add(pc.libre);
        const monde = decal.applyMatrix3(new THREE.Matrix3().setFromMatrix4(pc.obj.parent.matrixWorld)).length();
        const tolerance = Math.max(0.03, pc.taille * 0.3) * racine.scale.x;
        const etat = st.props.etat?.[a.id];
        if (etat && etat !== 'monte' && monde < tolerance) {
          pc.retour = true;
          st.props.onAimanter?.(a.id);
        }
        st.props.onManipule?.(true);
        return;
      }
      if (a.glisse) { st.props.onManipule?.(true); return; }
      if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 6) return;
      st.props.onSelection?.(a.id);
    };
    renderer.domElement.addEventListener('pointerdown', surAppui, { capture: true });
    renderer.domElement.addEventListener('pointermove', surMouvement);
    renderer.domElement.addEventListener('pointerup', surRelache);
    renderer.domElement.addEventListener('pointercancel', surRelache);

    function estVisible(o) {
      let p = o;
      while (p) { if (!p.visible) return false; p = p.parent; }
      return true;
    }

    // ── Boucle de rendu ───────────────────────────────────────────────────────
    const horloge = new THREE.Clock();
    const rayonAncre = new THREE.Raycaster();
    const planAncre = new THREE.Plane();
    const cibleAncre = new THREE.Vector3();
    let dernierEcart = 0;
    const qTmp = new THREE.Quaternion();
    const qArt = new THREE.Quaternion();
    const tmp = new THREE.Vector3();
    const art = new THREE.Vector3();
    const ecl = new THREE.Vector3();

    renderer.setAnimationLoop((t, frame) => {
      const pr = st.props;
      const dt = Math.min(horloge.getDelta(), 0.05);
      const pas = reduit() ? 1 : 1 - Math.exp(-dt * 6);
      if (!st.charge) { renderer.render(scene, st.camera); return; }
      if (frame) suivreXR(frame);

      const etat = pr.etat || {};
      const vals = pr.articulations || {};
      const selection = pr.selection;
      const isoles = pr.isoles?.length ? new Set(pr.isoles) : null;
      const masques = new Set(pr.masques || []);
      const allumes = new Set(pr.etatSignal?.allumes || []);
      const plan2d = pr.affichage === 'plan';
      const perdu = st.suivi === 'perdu';

      // Articulations : par pièce, translation, rotation ou étirement.
      const parPiece = new Map();
      for (const a of manifeste.articulations || []) {
        const v = vals[a.id] ?? a.valeur ?? 0;
        for (const c of a.cibles) parPiece.set(c.piece, [...(parPiece.get(c.piece) || []), { ...c, v }]);
      }

      for (const [id, pc] of st.pieces) {
        const { man, obj, ref } = pc;
        const e = etat[id] || 'monte';
        // Cible du scénario
        const cibleOff = e === 'monte' ? null : (man.fixation && e === 'devisse'
          ? v3(man.fixation.axe).multiplyScalar(man.fixation.degagement) : pc.depose);
        const cibleAng = man.fixation && e !== 'monte' ? man.fixation.tours * Math.PI * 2 : 0;
        if (st.etatsPrec[id] && st.etatsPrec[id] !== e && e !== 'depose') pc.retour = true;
        st.etatsPrec[id] = e;
        if (cibleOff) pc.off.lerp(cibleOff, pas); else pc.off.multiplyScalar(1 - pas);
        if (pc.off.lengthSq() < 1e-12 && !cibleOff) pc.off.set(0, 0, 0);
        if (cibleOff && pc.off.distanceToSquared(cibleOff) < 1e-12) pc.off.copy(cibleOff);
        pc.ang += (cibleAng - pc.ang) * pas;
        if (Math.abs(cibleAng - pc.ang) < 1e-5) pc.ang = cibleAng;
        if (pc.retour) {
          pc.libre.multiplyScalar(1 - pas);
          if (pc.libre.lengthSq() < 1e-12) { pc.libre.set(0, 0, 0); pc.retour = false; }
        }

        art.set(0, 0, 0);
        qArt.identity();
        let etire = null;
        for (const c of parPiece.get(id) || []) {
          if (c.type === 'translation') art.addScaledVector(v3(c.axe), c.v * c.facteur + (c.decalage || 0));
          else if (c.type === 'rotation') qArt.multiply(qTmp.setFromAxisAngle(v3(c.axe).normalize(), c.v * c.facteur));
          else if (c.type === 'etirer') etire = { axe: v3(c.axe), f: (c.longueur + c.v) / c.longueur };
        }
        ecl.set(0, 0, 0);
        if (man.eclate && pr.eclate) ecl.copy(v3(man.eclate.axe).normalize()).multiplyScalar(man.eclate.distance * pr.eclate);

        obj.position.copy(ref.p).add(art).add(ecl).add(pc.off).add(pc.libre);
        obj.quaternion.copy(ref.q);
        if (pc.ang) obj.quaternion.premultiply(qTmp.setFromAxisAngle(v3(man.fixation.axe).normalize(), pc.ang));
        obj.quaternion.premultiply(qArt);
        obj.scale.copy(ref.s);
        if (etire) {
          tmp.set(Math.abs(etire.axe.x), Math.abs(etire.axe.y), Math.abs(etire.axe.z));
          obj.scale.multiply(new THREE.Vector3(1, 1, 1).addScaledVector(tmp, etire.f - 1));
        }
        // Visibilité : isolement d'un organe (avec ses descendants) et masquage.
        const cle = man.organe || id;
        let visible = !masques.has(id) && !masques.has(cle);
        if (isoles) visible = isoles.has(id) || isoles.has(cle) || ancetreIsole(obj, isoles) || descendantIsole(obj, isoles);
        obj.visible = visible;
      }

      // Racine : déplacement de l'objet, calage caméra ou placement XR.
      if (!st.xr && pr.affichage === 'camera' && pr.ancre) {
        // Calage sur le marqueur : le centre de la maquette suit le centre du marqueur, sa taille suit
        // celle du marqueur et elle tourne avec lui dans le plan de l'image. Calage 2D approximatif.
        const a = pr.ancre;
        const { clientWidth: l, clientHeight: h } = noeud;
        const cam = st.camera;
        rayonAncre.setFromCamera(new THREE.Vector2((a.x / l) * 2 - 1, -(a.y / h) * 2 + 1), cam);
        const normale = cam.getWorldDirection(new THREE.Vector3()).negate();
        planAncre.setFromNormalAndCoplanarPoint(normale, controles.target);
        if (rayonAncre.ray.intersectPlane(planAncre, cibleAncre)) {
          const dist = cam.position.distanceTo(controles.target);
          const hauteurMonde = cam.isPerspectiveCamera ? 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) : (cam.top - cam.bottom) / cam.zoom;
          const marqueurMonde = (a.taille / h) * hauteurMonde;
          const echelle = (marqueurMonde * (pr.calage?.echelle ?? 1) * 3) / (2 * st.rayon);
          const k = a.perdu ? 0 : (reduit() ? 1 : 0.35);
          racine.position.lerp(cibleAncre.add(st.objet), k);
          racine.scale.setScalar(THREE.MathUtils.lerp(racine.scale.x, echelle, k));
          racine.rotation.set(0, THREE.MathUtils.degToRad(pr.calage?.rotation ?? 0), -a.angle);
        }
      } else if (!st.xr) {
        const c = pr.affichage === 'camera' ? (pr.calage || {}) : {};
        racine.scale.setScalar(c.echelle ?? 1);
        racine.position.set((c.x ?? 0) * st.rayon, (c.y ?? 0) * st.rayon, 0).add(st.objet);
        racine.rotation.set(0, THREE.MathUtils.degToRad(c.rotation ?? 0), 0);
      }

      // Coupe
      const coupe = pr.coupe;
      if (coupe?.actif && manifeste.coupe) {
        const n = v3(AXES_COUPE[manifeste.coupe.axe] || AXES_COUPE.z);
        const b = new THREE.Box3().setFromObject(racine);
        const min = b.min.dot(n.clone().negate());
        const max = b.max.dot(n.clone().negate());
        const pos = Math.min(min, max) + (Math.abs(max - min)) * (coupe.position ?? 0.5);
        plan.normal.copy(n);
        plan.constant = pos;
      }

      // Matériaux : surbrillance, estompage, plan 2D, signal, perte de suivi.
      const pouls = 0.35 + 0.25 * Math.sin(performance.now() / 260);
      for (const m of st.maillages) {
        const id = m.userData.id;
        const man = st.pieces.get(id)?.man;
        const choisi = !perdu && !pr.ancre?.perdu && selection && (id === selection || man?.organe === selection || ancetreChoisi(m, selection));
        m.material.clippingPlanes = coupe?.actif ? [plan] : [];
        m.material.side = coupe?.actif ? THREE.DoubleSide : m.userData.base.cote;
        m.userData.contour.visible = plan2d;
        if (plan2d) {
          m.userData.planMat.color.set(choisi ? 0xf6c6c3 : 0xffffff);
          m.userData.planMat.clippingPlanes = m.material.clippingPlanes;
          m.userData.planMat.side = m.material.side;
          m.userData.contour.material.clippingPlanes = m.material.clippingPlanes;
          if (m.material !== m.userData.planMat) { m.userData.mat3d = m.material; m.material = m.userData.planMat; }
          continue;
        }
        if (m.userData.mat3d && m.material === m.userData.planMat) m.material = m.userData.mat3d;
        const mat = m.material;
        mat.clippingPlanes = coupe?.actif ? [plan] : [];
        mat.side = coupe?.actif ? THREE.DoubleSide : m.userData.base.cote;
        if (!mat.emissive) continue;
        if (choisi) { mat.emissive.copy(SURBRILLANCE); mat.emissiveIntensity = pouls; }
        else if (allumes.has(id)) { mat.emissive.set(pr.etatSignal.couleur || '#ffffff'); mat.emissiveIntensity = 1.6; }
        else { mat.emissive.copy(NOIR); mat.emissiveIntensity = 0; }
        const estompe = Boolean(selection) && !choisi;
        const cible = estompe ? 0.25 : m.userData.base.opacite;
        mat.opacity += (cible - mat.opacity) * pas;
        mat.transparent = m.userData.base.transparent || mat.opacity < 0.99;
        mat.depthWrite = mat.opacity > 0.9;
        // Repères seuls : le maillage reste en place (isolement, repères) mais n'est plus dessiné.
        mat.visible = !(pr.affichage === 'camera' && pr.reperesSeuls);
      }

      // Fond
      const camera = pr.affichage === 'camera' || st.xr;
      scene.background = camera ? null : new THREE.Color(plan2d ? 0xffffff : 0xeef1f4);
      atelier.visible = !camera && !plan2d && pr.fond === 'atelier';
      renderer.domElement.style.opacity = pr.affichage === 'camera' ? String(pr.opacite ?? 1) : '1';

      // Vol de caméra vers une vue rapide
      if (st.vol) {
        st.vol.t = Math.min(1, st.vol.t + dt / 0.45);
        const k = 1 - (1 - st.vol.t) ** 3;
        st.camera.position.lerpVectors(st.vol.de.pos, st.vol.a.pos, k);
        controles.target.lerpVectors(st.vol.de.tgt, st.vol.a.tgt, k);
        st.camera.zoom = THREE.MathUtils.lerp(st.vol.de.zoom, 1, k);
        st.camera.updateProjectionMatrix();
        if (st.vol.t >= 1) st.vol = null;
      }

      // Écart à la pose de référence, quand tout est monté.
      if (t - dernierEcart > 250) {
        dernierEcart = t;
        let max = 0;
        for (const [, pc] of st.pieces) max = Math.max(max, pc.off.length() + pc.libre.length() + Math.abs(pc.ang) * 0.001);
        const mm = Math.round(max * 1000 * 100) / 100;
        if (mm !== st.ecartEnvoye) { st.ecartEnvoye = mm; pr.onEcart?.(mm); }
      }

      positionnerEtiquettes(pr, perdu);
      if (!renderer.xr.isPresenting) controles.update();
      renderer.render(scene, st.camera);
    });

    function ancetreChoisi(o, sel) {
      let p = o.parent;
      while (p) {
        const id = p.userData.piece;
        if (id && (id === sel || st.pieces.get(id)?.man.organe === sel)) return true;
        p = p.parent;
      }
      return false;
    }
    function ancetreIsole(o, isoles) {
      let p = o.parent;
      while (p) {
        const id = p.userData.piece;
        if (id && (isoles.has(id) || isoles.has(st.pieces.get(id)?.man.organe))) return true;
        p = p.parent;
      }
      return false;
    }
    function descendantIsole(o, isoles) {
      let trouve = false;
      o.traverse((c) => {
        if (trouve || c === o) return;
        const id = c.userData.piece;
        if (id && (isoles.has(id) || isoles.has(st.pieces.get(id)?.man.organe))) trouve = true;
      });
      return trouve;
    }

    const projete = new THREE.Vector3();
    function positionnerEtiquettes(pr, perdu) {
      const zone = etiquettes.current;
      if (!zone || !st.etiquettes) return;
      const visibles = !perdu && !st.xr && !pr.ancre?.perdu
        && (pr.affichage === 'plan' || (pr.affichage === 'camera' && pr.reperesSeuls) || pr.reperes);
      zone.hidden = !visibles;
      if (!visibles) return;
      const { clientWidth: l, clientHeight: h } = noeud;
      for (const g of st.etiquettes) {
        const b = new THREE.Box3();
        for (const id of g.pieces) {
          const pc = st.pieces.get(id);
          if (pc && estVisible(pc.obj)) b.expandByObject(pc.obj);
        }
        if (b.isEmpty()) { g.el.hidden = true; continue; }
        b.getCenter(projete).project(st.camera);
        const dehors = projete.z > 1 || Math.abs(projete.x) > 1.02 || Math.abs(projete.y) > 1.02;
        g.el.hidden = dehors;
        g.el.style.transform = `translate(${((projete.x + 1) / 2) * l - 13}px, ${((1 - projete.y) / 2) * h - 13}px)`;
        g.el.classList.toggle('repere-actif', pr.selection === g.organe || g.pieces.includes(pr.selection));
      }
    }

    // ── RA suivie (WebXR, hit-test) ───────────────────────────────────────────
    function suivreXR(frame) {
      const x = st.xr;
      if (!x) return;
      const espace = renderer.xr.getReferenceSpace();
      const pose = frame.getViewerPose(espace);
      const qualite = !pose ? 'perdu' : (pose.emulatedPosition ? 'limite' : 'bon');
      if (qualite !== st.suivi) { st.suivi = qualite; x.onSuivi?.(qualite); }
      if (x.place || !x.source) return;
      const res = frame.getHitTestResults(x.source);
      if (res.length) {
        const p = res[0].getPose(espace);
        x.reticule.visible = true;
        x.reticule.matrix.fromArray(p.transform.matrix);
      } else x.reticule.visible = false;
    }

    st.lancerXR = async ({ overlay, echelle = 0.3, onSuivi, onFin }) => {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'local-floor'],
        ...(overlay ? { domOverlay: { root: overlay } } : {}),
      });
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session);
      const vue = await session.requestReferenceSpace('viewer');
      const source = await session.requestHitTestSource({ space: vue });
      const reticule = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      reticule.matrixAutoUpdate = false;
      reticule.visible = false;
      scene.add(reticule);
      const avant = { p: racine.position.clone(), q: racine.quaternion.clone(), s: racine.scale.clone() };
      st.xr = { session, source, reticule, place: false, onSuivi, echelle };
      session.addEventListener('select', () => {
        const x = st.xr;
        if (!x || x.place || !x.reticule.visible) return;
        const pos = new THREE.Vector3().setFromMatrixPosition(x.reticule.matrix);
        racine.scale.setScalar(x.echelle);
        racine.position.copy(pos).add(new THREE.Vector3(0, -st.bas * x.echelle, 0));
        racine.quaternion.identity();
        x.place = true;
        x.reticule.visible = false;
        x.onSuivi?.(st.suivi || 'bon', true);
      });
      session.addEventListener('end', () => {
        source.cancel?.();
        scene.remove(reticule);
        reticule.geometry.dispose();
        racine.position.copy(avant.p);
        racine.quaternion.copy(avant.q);
        racine.scale.copy(avant.s);
        st.xr = null;
        st.suivi = null;
        dimensionner();
        onFin?.();
      });
    };

    return () => {
      actif = false;
      st.charge = false;
      st.xr?.session.end().catch(() => {});
      observateur.disconnect();
      renderer.setAnimationLoop(null);
      controles.dispose();
      st.maillages.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
        m.userData.mat3d?.dispose();
        m.userData.planMat.dispose();
        m.userData.contour.geometry.dispose();
        m.userData.contour.material.dispose();
      });
      atelier.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
      etiquettes.current?.replaceChildren();
      st.pieces = new Map();
      st.maillages = [];
    };
  }, [props.glb, props.manifeste]);

  // Projection : orthographique imposée en plan 2D.
  useEffect(() => {
    s.current.changerCamera?.(props.affichage === 'plan' || props.projection === 'orthographique');
  }, [props.affichage, props.projection]);

  // Vue de face pour la caméra réelle ; commandes d'orbite coupées pendant le calage.
  useEffect(() => {
    const st = s.current;
    if (!st.controles) return;
    st.controles.enabled = props.affichage !== 'camera';
    if (props.affichage === 'camera') st.allerVue?.('face', true);
  }, [props.affichage]);

  useImperativeHandle(ref, () => ({
    vue: (nom) => s.current.allerVue?.(nom),
    recentrer: () => {
      const st = s.current;
      st.objet.set(0, 0, 0);
      st.allerVue?.(st.vueCourante || 'trois_quarts');
    },
    zoomer: (f) => {
      const { camera, controles } = s.current;
      if (!camera) return;
      if (camera.isOrthographicCamera) camera.zoom = THREE.MathUtils.clamp(camera.zoom * f, 0.1, 40);
      else camera.position.sub(controles.target).multiplyScalar(1 / f).add(controles.target);
      camera.updateProjectionMatrix();
    },
    tourner: (azimut, elevation) => {
      const { camera, controles } = s.current;
      if (!camera) return;
      const off = camera.position.clone().sub(controles.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta += azimut;
      sph.phi = THREE.MathUtils.clamp(sph.phi - elevation, 0.05, Math.PI - 0.05);
      camera.position.copy(controles.target).add(off.setFromSpherical(sph));
    },
    /** Remet les pièces déplacées à la main et l'objet à leur place, sans toucher au scénario. */
    remettreEnPlace: () => {
      const st = s.current;
      st.pieces?.forEach((pc) => { pc.retour = true; });
      st.objet?.set(0, 0, 0);
    },
    /** Pose immédiate : utilisée à la réinitialisation pour revenir exactement à la référence. */
    reinitialiser: () => {
      s.current.pieces?.forEach((pc) => { pc.off.set(0, 0, 0); pc.ang = 0; pc.libre.set(0, 0, 0); pc.retour = false; });
      s.current.objet?.set(0, 0, 0);
    },
    lancerXR: (options) => s.current.lancerXR(options),
    reancrer: () => { if (s.current.xr) s.current.xr.place = false; },
    quitterXR: () => s.current.xr?.session.end(),
    canvas: () => s.current.renderer?.domElement,
  }), []);

  return (
    <div ref={hote} className={`scene3d${props.affichage === 'camera' ? ' scene3d-transparente' : ''}`}>
      <div ref={etiquettes} className="reperes" hidden />
    </div>
  );
});

export default Scene3D;
