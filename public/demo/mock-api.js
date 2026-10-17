/*!
 * MA-RA (console de maintenance augmentée) : API de démonstration, données simulées.
 * Chargé AVANT le bundle (uniquement dans le build `--mode demo`). Intercepte fetch,
 * XMLHttpRequest, WebSocket, EventSource et sendBeacon : aucune requête ne part vers
 * le backend .NET ni vers le service IA ; les appels /api/... sont servis ici.
 *
 * Simulation pédagogique, ce n'est pas le modèle entraîné : YOLOv8-nano et
 * EfficientNet-B0 ne tournent pas dans le navigateur. Pour les images d'exemple
 * (illustrations générées, dossier demo/samples), la démo renvoie une détection
 * prédéfinie dont les scores sont tirés autour de valeurs fixées, puis applique la
 * logique réelle du pipeline (app/ai/pipeline.py) :
 *   - filtrage theta_det = 0,45 ;
 *   - fusion s_final = 0,35 s_det + 0,65 s_cls ;
 *   - lissage : moyenne glissante sur 5 images par session et par classe ;
 *   - pré-activation Vuforia si le score lissé >= 0,70 ;
 *   - repli marqueur QR recommandé si aucune détection.
 * Une image caméra réelle ne produit aucune détection (repli QR), puisque aucun
 * modèle n'est exécuté. Référentiel, gammes, documents et journal sont fictifs.
 */
(function () {
  'use strict';
  if (window.__DEMO_MOCK__) return;

  var SITE = {
    name: 'mara',
    badge: 'Démo · données simulées · détection simulée',
    badgeCss: 'right:10px;bottom:10px;',
    isApi: function (u) { return /^\/api(\/|$)/.test(u.pathname); },
    fallback: function (ctx) {
      if (ctx.method !== 'GET') return R(204, null);
      return R(404, { message: 'Ressource absente de la démo.' });
    },
    delay: function () { return 150 + Math.floor(Math.random() * 200); },
    routes: []
  };

  function prng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function uuid(rnd) {
    var r = rnd || Math.random, h = '';
    for (var i = 0; i < 32; i++) h += Math.floor(r() * 16).toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32);
  }
  var NOW = Date.now(), DAY = 86400000;
  function iso(t) { return new Date(t).toISOString(); }
  function round(x, n) { var p = Math.pow(10, n == null ? 3 : n); return Math.round(x * p) / p; }
  function clamp(x) { return Math.max(0, Math.min(0.99, x)); }

  var DIRECTION = {
    moteur_traction: 'DMAT', bogie_essieux: 'DMAT', compresseur: 'DMAT', pompe_eau: 'DMAT', grue_ferroviaire: 'DMAT',
    pont_roulant: 'DMAT', tours_atelier: 'DMAT', draisine: 'DMAT', aiguillage: 'DIF', transformateur_ht: 'DIF',
    groupe_electrogene: 'DIF', signal_ferroviaire: 'DIF'
  };

  var LABEL = { aiguillage: 'aiguillage', signal_ferroviaire: 'signal ferroviaire', groupe_electrogene: 'groupe électrogène', compresseur: 'compresseur', moteur_traction: 'moteur de traction', bogie_essieux: 'bogie et essieux' };

  /* ---------- Comptes ---------- */
  function users() {
    var u = S.get('users');
    if (!u) {
      var rnd = prng(3);
      u = [['tech.dmat', 'DMAT'], ['tech.dif', 'DIF'], ['admin.ci', 'ADMIN'], ['coord.ci', 'CI'], ['formateur.cif', 'CIF'], ['agent.atelier', 'DMAT'], ['agent.voie', 'DIF']]
        .map(function (x, i) { return { id: uuid(rnd), userName: x[0], email: x[0] + '@exemple.org', groupe: x[1], isActive: i !== 6, createdAt: iso(NOW - (240 - i * 25) * DAY) }; });
      S.set('users', u);
    }
    return u;
  }
  function me() { var n = S.get('session'); return users().filter(function (u) { return u.userName === n; })[0] || null; }
  function need() { return me() ? null : R(401, { message: 'Non authentifié.' }); }
  function adminOnly() { var u = me(); if (!u) return R(401, { message: 'Non authentifié.' }); return u.groupe === 'ADMIN' ? null : R(403, { message: 'Réservé au groupe ADMIN.' }); }

  /* ---------- Référentiel fictif ---------- */
  var EQ_SEED = [
    ['MT-0412', 'Moteur de traction, locomotive série fictive 2200', 'moteur_traction', 'DMAT', 'VF-MT-0412', 'actif'],
    ['BG-1108', 'Bogie porteur de voiture voyageurs', 'bogie_essieux', 'DMAT', 'VF-BG-1108', 'actif'],
    ['CP-12', 'Compresseur d\'air principal, atelier fictif', 'compresseur', 'DMAT', 'VF-CP-12', 'actif'],
    ['PE-07', 'Pompe à eau de refroidissement', 'pompe_eau', 'DMAT', null, 'maintenance'],
    ['GR-02', 'Grue ferroviaire de relevage 80 t', 'grue_ferroviaire', 'DMAT', 'VF-GR-02', 'actif'],
    ['PR-01', 'Pont roulant 10 t, halle de levage', 'pont_roulant', 'DMAT', 'VF-PR-01', 'actif'],
    ['TA-03', 'Tour en fosse à reprofiler les roues', 'tours_atelier', 'DMAT', 'VF-TA-03', 'actif'],
    ['DR-05', 'Draisine d\'inspection de voie', 'draisine', 'DMAT', null, 'actif'],
    ['AG-214', 'Aiguillage simple, entrée de gare fictive', 'aiguillage', 'DIF', 'VF-AG-214', 'actif'],
    ['TR-HT-1', 'Transformateur HT de sous-station', 'transformateur_ht', 'DIF', 'VF-TR-1', 'actif'],
    ['GE-03', 'Groupe électrogène de secours, poste de signalisation', 'groupe_electrogene', 'DIF', 'VF-GE-03', 'actif'],
    ['S-214', 'Signal lumineux d\'entrée S 214', 'signal_ferroviaire', 'DIF', 'VF-S-214', 'actif'],
    ['MT-0398', 'Moteur de traction déposé', 'moteur_traction', 'DMAT', null, 'reforme']
  ];
  function equipements() {
    var e = S.get('equipements');
    if (!e) {
      var rnd = prng(17);
      e = EQ_SEED.map(function (x, i) { return { id: uuid(rnd), code: x[0], designation: x[1], classe: x[2], direction: x[3], marqueur: x[4], statut: x[5], description: 'Équipement fictif de démonstration.', createdAt: iso(NOW - (200 - i) * DAY), updatedAt: iso(NOW - (20 + i * 3) * DAY) }; });
      S.set('equipements', e);
    }
    return e;
  }
  var STEPS = {
    aiguillage: [['Annoncer l\'intervention au poste et obtenir la consignation de l\'aiguillage', 'ROUGE', 300], ['Vérifier l\'absence de circulation et poser les protections', 'ROUGE', 240], ['Nettoyer et graisser les coussinets de glissement', 'NONE', 600], ['Contrôler l\'écartement et le jeu des lames', 'ORANGE', 420], ['Manœuvrer l\'aiguillage et vérifier le contrôle de position', 'ORANGE', 300], ['Restituer l\'aiguillage au poste', 'ROUGE', 120]],
    signal_ferroviaire: [['Consigner le signal auprès du poste', 'ROUGE', 240], ['Nettoyer les optiques et vérifier les lampes', 'NONE', 480], ['Mesurer la tension d\'alimentation des feux', 'ORANGE', 300], ['Essai d\'allumage de chaque feu avec le poste', 'ORANGE', 360], ['Déconsigner et consigner l\'essai au registre', 'ROUGE', 120]],
    groupe_electrogene: [['Mettre le groupe hors service et condamner le démarrage', 'ROUGE', 180], ['Contrôler les niveaux d\'huile et de liquide de refroidissement', 'NONE', 300], ['Vérifier la batterie de démarrage', 'ORANGE', 240], ['Essai de démarrage à vide puis en charge', 'ORANGE', 900], ['Remettre en mode automatique', 'NONE', 60]],
    compresseur: [['Consigner électriquement le compresseur', 'ROUGE', 180], ['Purger le réservoir principal', 'ORANGE', 240], ['Remplacer le filtre d\'aspiration', 'NONE', 420], ['Contrôler la soupape de sûreté', 'ORANGE', 300], ['Essai de montée en pression', 'ORANGE', 600]],
    moteur_traction: [['Isoler la locomotive et poser la consignation', 'ROUGE', 300], ['Mesurer l\'isolement des enroulements', 'ORANGE', 900], ['Contrôler l\'usure des balais et du collecteur', 'NONE', 1200], ['Graisser les paliers', 'NONE', 600]],
    bogie_essieux: [['Caler le véhicule et poser la signalisation d\'atelier', 'ROUGE', 240], ['Contrôler les boîtes d\'essieux', 'ORANGE', 900], ['Mesurer le profil des roues', 'NONE', 600]]
  };
  function gammes() {
    var g = S.get('gammes');
    if (!g) {
      var rnd = prng(29), k = 0;
      g = Object.keys(STEPS).map(function (c, i) {
        return {
          id: uuid(rnd), code: 'GM-' + DIRECTION[c] + '-' + ('0' + (i + 1)).slice(-2), titre: 'Visite préventive · ' + LABEL[c], classeEquipement: c,
          direction: DIRECTION[c], version: 1 + (i % 3), isActive: true, equipementId: null, createdAt: iso(NOW - (150 - i) * DAY), updatedAt: iso(NOW - (10 + i * 4) * DAY),
          etapes: STEPS[c].map(function (s, j) { k++; return { id: uuid(rnd), ordreIndex: j + 1, description: s[0], arContentRef: 'ar/' + c + '/etape-' + (j + 1), niveauSecurite: s[1], dureeSecondes: s[2], detail: null }; })
        };
      });
      g.push({ id: uuid(rnd), code: 'GM-DMAT-90', titre: 'Ancienne gamme compresseur (désactivée)', classeEquipement: 'compresseur', direction: 'DMAT', version: 1, isActive: false, equipementId: null, createdAt: iso(NOW - 400 * DAY), updatedAt: iso(NOW - 180 * DAY), etapes: [] });
      S.set('gammes', g);
    }
    return g;
  }
  function summary(g) { return { id: g.id, code: g.code, titre: g.titre, classeEquipement: g.classeEquipement, direction: g.direction, version: g.version, isActive: g.isActive, nbEtapes: g.etapes.length, updatedAt: g.updatedAt }; }
  function documents() {
    var d = S.get('documents');
    if (!d) {
      var rnd = prng(31), eq = equipements();
      d = [['Manuel_compresseur_CP-12.pdf', 'manuel', 2, 2480000], ['Schema_aiguillage_AG-214.pdf', 'schema', 8, 940000], ['Gamme_signal_S-214.pdf', 'gamme', 11, 320000], ['GE-03_groupe_electrogene.glb', 'modele3d', 10, 7800000], ['Manuel_moteur_traction.pdf', 'manuel', 0, 5100000], ['Consignes_securite_atelier.pdf', 'autre', null, 210000]]
        .map(function (x, i) { var id = uuid(rnd); return { id: id, nomFichier: x[0], typeDocument: x[1], tailleOctets: x[3], description: 'Document fictif de démonstration.', equipementId: x[2] == null ? null : eq[x[2]].id, downloadUrl: '/api/documents/' + id + '/download', createdAt: iso(NOW - (60 - i * 7) * DAY) }; });
      S.set('documents', d);
    }
    return d;
  }
  function eqResponse(e) {
    return Object.assign({}, e, {
      nbGammes: gammes().filter(function (g) { return g.isActive && g.classeEquipement === e.classe; }).length,
      nbDocuments: documents().filter(function (d) { return d.equipementId === e.id; }).length
    });
  }

  /* ---------- Détection simulée ---------- */
  // Valeurs centrales fixées pour chaque image d'exemple (boîte en coordonnées normalisées).
  var SAMPLES = {
    aiguillage: [{ cls: 'aiguillage', det: 0.82, clsScore: 0.88, box: [0.24, 0.40, 0.92, 0.99] }],
    signal: [{ cls: 'signal_ferroviaire', det: 0.86, clsScore: 0.91, box: [0.39, 0.13, 0.57, 0.87] }],
    'groupe-electrogene': [{ cls: 'groupe_electrogene', det: 0.79, clsScore: 0.84, box: [0.17, 0.18, 0.84, 0.80] }, { cls: 'transformateur_ht', det: 0.47, clsScore: 0.41, box: [0.52, 0.34, 0.79, 0.57] }],
    compresseur: [{ cls: 'compresseur', det: 0.74, clsScore: 0.69, box: [0.16, 0.28, 0.84, 0.80] }],
    'atelier-vide': []
  };
  var THETA_DET = 0.45, LAMBDA = 0.35, PREACT = 0.70, WINDOW = 5;
  var buffers = {};
  function infer(sessionId) {
    var t0 = performance.now();
    var sample = window.__MARA_SAMPLE__ || null;
    var raw = (SAMPLES[sample] || []).map(function (s) {
      return { cls: s.cls, det: clamp(s.det + (Math.random() - 0.5) * 0.08), clsScore: clamp(s.clsScore + (Math.random() - 0.5) * 0.08), box: s.box };
    }).filter(function (r) { return r.det >= THETA_DET; });
    var dets = raw.map(function (r) {
      var fin = LAMBDA * r.det + (1 - LAMBDA) * r.clsScore;
      var key = sessionId + '|' + r.cls, b = buffers[key] || (buffers[key] = []);
      b.push(fin); if (b.length > WINDOW) b.shift();
      var sm = b.reduce(function (a, x) { return a + x; }, 0) / b.length;
      return { class: r.cls, scoreFinal: round(fin), scoreDet: round(r.det), scoreCls: round(r.clsScore), scoreSmoothed: round(sm), preActivateVuforia: sm >= PREACT, boundingBox: { x1: r.box[0], y1: r.box[1], x2: r.box[2], y2: r.box[3], confidence: round(r.det) } };
    }).sort(function (a, b) { return b.scoreSmoothed - a.scoreSmoothed; });
    return { sessionId: sessionId, detections: dets, fallbackQrRecommended: dets.length === 0, inferenceMs: round(performance.now() - t0, 2), pipelineVersion: 'demo-simulation (YOLOv8n + EfficientNet-B0 non exécutés)' };
  }

  /* ---------- Journal d'intervention fictif ---------- */
  function interventions() {
    var l = S.get('interventions');
    if (!l) {
      var rnd = prng(41), us = users(), cls = ['aiguillage', 'signal_ferroviaire', 'groupe_electrogene', 'compresseur', 'moteur_traction', 'bogie_essieux', null];
      l = [];
      for (var i = 0; i < 150; i++) {
        var u = us[Math.floor(rnd() * 5)], c = cls[Math.floor(rnd() * cls.length)], t = NOW - Math.floor(rnd() * 90 * DAY);
        var sc = c ? round(0.55 + rnd() * 0.4, 3) : null;
        l.push({ id: uuid(rnd), userId: u.id, userGroupe: u.groupe, equipementId: null, gammeId: null, classeDetectee: c, scoreConfiance: sc, fallbackQr: !c, sessionId: 'console-' + uuid(rnd).slice(0, 8), debutAt: iso(t), finAt: rnd() < 0.95 ? iso(t + Math.floor((5 + rnd() * 50) * 60000)) : null, notes: null });
      }
      S.set('interventions', l);
    }
    return l;
  }

  /* ---------- Routes ---------- */
  route('POST', /^\/auth\/login$/, function (ctx) {
    var b = ctx.body || {}, u = users().filter(function (x) { return x.userName === String(b.userName || '').trim().toLowerCase(); })[0];
    if (!u || !b.password) return R(401, { message: 'Identifiants invalides.' });
    if (!u.isActive) return R(401, { message: 'Compte inactif.' });
    S.set('session', u.userName);
    return { accessToken: 'demo.' + uuid(), refreshToken: 'demo.' + uuid(), expiresAt: iso(Date.now() + 3600000), userName: u.userName, groupe: u.groupe };
  });
  route('POST', /^\/auth\/refresh$/, function () { var u = me(); return u ? { accessToken: 'demo.' + uuid(), refreshToken: 'demo.' + uuid(), expiresAt: iso(Date.now() + 3600000), userName: u.userName, groupe: u.groupe } : R(401, { message: 'Refresh token invalide ou expiré.' }); });
  route('GET', /^\/auth\/me$/, function () { return me() || R(401, { message: 'Non authentifié.' }); });
  route('POST', /^\/auth\/logout$/, function () { S.set('session', null); return R(204, null); });

  route('GET', /^\/users$/, function (ctx) { var no = adminOnly(); if (no) return no; return users().filter(function (u) { return !ctx.query.groupe || u.groupe === ctx.query.groupe; }); });
  route('GET', /^\/users\/([^/]+)$/, function (ctx) { var no = adminOnly(); return no || users().filter(function (u) { return u.id === ctx.params[1]; })[0] || R(404, { message: 'Utilisateur introuvable.' }); });
  route('POST', /^\/users$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var b = ctx.body || {}, l = users();
    if (!b.userName || !b.password || String(b.password).length < 8) return R(400, { message: 'Identifiant et mot de passe (8 caractères minimum) requis.' });
    if (l.some(function (u) { return u.userName === b.userName; })) return R(409, { message: 'Identifiant déjà utilisé.' });
    var u = { id: uuid(), userName: String(b.userName).toLowerCase(), email: String(b.userName).toLowerCase() + '@exemple.org', groupe: b.groupe || 'DMAT', isActive: true, createdAt: iso(Date.now()) };
    l.push(u); S.set('users', l); return R(201, u);
  });
  function patchUser(id, fn) {
    var l = users(), u = l.filter(function (x) { return x.id === id; })[0];
    if (!u) return R(404, { message: 'Utilisateur introuvable.' });
    if (u.userName === S.get('session')) return R(400, { message: 'Impossible de modifier votre propre compte.' });
    fn(u); S.set('users', l); return u;
  }
  route('PATCH', /^\/users\/([^/]+)\/active$/, function (ctx) { var no = adminOnly(); return no || patchUser(ctx.params[1], function (u) { u.isActive = ctx.body === true || ctx.body === 'true'; }); });
  route('PATCH', /^\/users\/([^/]+)\/groupe$/, function (ctx) { var no = adminOnly(); return no || patchUser(ctx.params[1], function (u) { u.groupe = String(ctx.body); }); });
  route('DELETE', /^\/users\/([^/]+)$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var r = patchUser(ctx.params[1], function () {}); if (r && r.__r) return r;
    S.set('users', users().filter(function (u) { return u.id !== ctx.params[1]; })); return R(204, null);
  });

  route('GET', /^\/equipements$/, function (ctx) {
    var no = need(); if (no) return no; var q = ctx.query;
    return equipements().filter(function (e) { return (!q.direction || e.direction === q.direction) && (!q.classe || e.classe === q.classe) && (!q.statut || e.statut === q.statut); }).map(eqResponse);
  });
  route('GET', /^\/equipements\/([^/]+)$/, function (ctx) { var no = need(); if (no) return no; var e = equipements().filter(function (x) { return x.id === ctx.params[1]; })[0]; return e ? eqResponse(e) : R(404, { message: 'Équipement introuvable.' }); });
  route('POST', /^\/equipements$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var b = ctx.body || {}, l = equipements();
    if (!b.code || !b.designation || !b.classe || !b.direction) return R(400, { message: 'Code, désignation, classe et direction requis.' });
    if (l.some(function (e) { return e.code === b.code; })) return R(409, { message: 'Ce code existe déjà.' });
    var e = { id: uuid(), code: b.code, designation: b.designation, classe: b.classe, direction: b.direction, marqueur: b.marqueur || null, statut: b.statut || 'actif', description: b.description || null, createdAt: iso(Date.now()), updatedAt: iso(Date.now()) };
    l.push(e); S.set('equipements', l); return R(201, eqResponse(e));
  });
  route('PUT', /^\/equipements\/([^/]+)$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var l = equipements(), e = l.filter(function (x) { return x.id === ctx.params[1]; })[0];
    if (!e) return R(404, { message: 'Équipement introuvable.' });
    ['code', 'designation', 'classe', 'direction', 'marqueur', 'statut', 'description'].forEach(function (k) { if (ctx.body && k in ctx.body) e[k] = ctx.body[k]; });
    e.updatedAt = iso(Date.now()); S.set('equipements', l); return eqResponse(e);
  });
  route('DELETE', /^\/equipements\/([^/]+)$/, function (ctx) { var no = adminOnly(); if (no) return no; S.set('equipements', equipements().filter(function (x) { return x.id !== ctx.params[1]; })); return R(204, null); });

  route('GET', /^\/gammes\/by-class\/([^/]+)$/, function (ctx) { var no = need(); if (no) return no; return gammes().filter(function (g) { return g.isActive && g.classeEquipement === decodeURIComponent(ctx.params[1]); }); });
  route('GET', /^\/gammes$/, function (ctx) {
    var no = need(); if (no) return no; var q = ctx.query;
    return gammes().filter(function (g) { return (!q.direction || g.direction === q.direction) && (!q.classeEquipement || g.classeEquipement === q.classeEquipement) && (q.activeOnly === 'false' || g.isActive); }).map(summary);
  });
  route('GET', /^\/gammes\/([^/]+)$/, function (ctx) { var no = need(); if (no) return no; return gammes().filter(function (g) { return g.id === ctx.params[1]; })[0] || R(404, { message: 'Gamme introuvable.' }); });
  route('POST', /^\/gammes$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var b = ctx.body || {}, l = gammes();
    if (!b.code || !b.titre || !b.classeEquipement || !b.direction) return R(400, { message: 'Code, titre, classe et direction requis.' });
    var g = { id: uuid(), code: b.code, titre: b.titre, classeEquipement: b.classeEquipement, direction: b.direction, version: 1, isActive: b.isActive !== false, equipementId: b.equipementId || null, etapes: [], createdAt: iso(Date.now()), updatedAt: iso(Date.now()) };
    l.push(g); S.set('gammes', l); return R(201, g);
  });
  function withGamme(id, fn) {
    var l = gammes(), g = l.filter(function (x) { return x.id === id; })[0];
    if (!g) return R(404, { message: 'Gamme introuvable.' });
    var out = fn(g); g.updatedAt = iso(Date.now()); S.set('gammes', l); return out === undefined ? g : out;
  }
  route('PUT', /^\/gammes\/([^/]+)$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    return withGamme(ctx.params[1], function (g) { ['code', 'titre', 'classeEquipement', 'direction', 'isActive', 'equipementId'].forEach(function (k) { if (ctx.body && k in ctx.body) g[k] = ctx.body[k]; }); g.version += 1; });
  });
  route('DELETE', /^\/gammes\/([^/]+)$/, function (ctx) { var no = adminOnly(); if (no) return no; S.set('gammes', gammes().filter(function (x) { return x.id !== ctx.params[1]; })); return R(204, null); });
  route('POST', /^\/gammes\/([^/]+)\/etapes$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    return withGamme(ctx.params[1], function (g) {
      var b = ctx.body || {}, s = { id: uuid(), ordreIndex: Number(b.ordreIndex) || g.etapes.length + 1, description: b.description || '', arContentRef: b.arContentRef || null, niveauSecurite: b.niveauSecurite || 'NONE', dureeSecondes: b.dureeSecondes == null ? null : Number(b.dureeSecondes), detail: b.detail || null };
      g.etapes.push(s); g.etapes.sort(function (a, c) { return a.ordreIndex - c.ordreIndex; }); return R(201, s);
    });
  });
  route('PUT', /^\/gammes\/([^/]+)\/etapes\/([^/]+)$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    return withGamme(ctx.params[1], function (g) {
      var s = g.etapes.filter(function (x) { return x.id === ctx.params[2]; })[0];
      if (!s) return R(404, { message: 'Étape introuvable.' });
      Object.keys(ctx.body || {}).forEach(function (k) { if (k !== 'id') s[k] = ctx.body[k]; });
      g.etapes.sort(function (a, c) { return a.ordreIndex - c.ordreIndex; }); return s;
    });
  });
  route('DELETE', /^\/gammes\/([^/]+)\/etapes\/([^/]+)$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    return withGamme(ctx.params[1], function (g) { g.etapes = g.etapes.filter(function (x) { return x.id !== ctx.params[2]; }); return R(204, null); });
  });

  route('GET', /^\/documents$/, function (ctx) {
    var no = need(); if (no) return no; var q = ctx.query;
    return documents().filter(function (d) { return (!q.equipementId || d.equipementId === q.equipementId) && (!q.typeDocument || d.typeDocument === q.typeDocument); });
  });
  route('POST', /^\/documents$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var b = ctx.body || {}, l = documents(), id = uuid();
    var d = { id: id, nomFichier: String(b.file || 'document'), typeDocument: b.typeDocument || 'autre', tailleOctets: 0, description: (b.description || '') + ' (démo : le fichier n\'est pas conservé)', equipementId: b.equipementId || null, downloadUrl: '/api/documents/' + id + '/download', createdAt: iso(Date.now()) };
    l.unshift(d); S.set('documents', l); return R(201, d);
  });
  route('GET', /^\/documents\/([^/]+)\/download$/, function (ctx) {
    var no = need(); if (no) return no;
    var d = documents().filter(function (x) { return x.id === ctx.params[1]; })[0];
    if (!d) return R(404, { message: 'Document introuvable.' });
    return R(200, 'Document fictif de démonstration MA-RA : ' + d.nomFichier + '\nLe contenu réel n\'est pas fourni dans la démo.\n', { 'content-type': 'text/plain; charset=utf-8' });
  });
  route('DELETE', /^\/documents\/([^/]+)$/, function (ctx) { var no = adminOnly(); if (no) return no; S.set('documents', documents().filter(function (x) { return x.id !== ctx.params[1]; })); return R(204, null); });

  route('GET', /^\/inference\/health$/, function () { return { available: true }; });
  route('POST', /^\/inference$/, function (ctx) {
    var no = need(); if (no) return no;
    var u = me(), res = infer(String((ctx.body || {}).sessionId || 'console'));
    var best = res.detections.slice().sort(function (a, b) { return b.scoreFinal - a.scoreFinal; })[0];
    var l = interventions();
    l.push({ id: uuid(), userId: u.id, userGroupe: u.groupe, equipementId: null, gammeId: null, classeDetectee: best ? best.class : null, scoreConfiance: best ? best.scoreFinal : null, fallbackQr: res.fallbackQrRecommended, sessionId: res.sessionId, debutAt: iso(Date.now()), finAt: null, notes: null });
    S.set('interventions', l);
    return res;
  });

  route('GET', /^\/kpi\/dashboard$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var days = Number(ctx.query.days) || 30, since = Date.now() - days * DAY;
    var logs = interventions().filter(function (l) { return Date.parse(l.debutAt) >= since; });
    var scored = logs.filter(function (l) { return l.scoreConfiance != null; });
    function group(key, extra) {
      var m = {};
      logs.forEach(function (l) { var k = l[key]; if (k == null) return; m[k] = m[k] || { count: 0, fallbackCount: 0 }; m[k].count++; if (l.fallbackQr) m[k].fallbackCount++; });
      return Object.keys(m).map(function (k) { var o = {}; o[extra] = k; o.count = m[k].count; o.fallbackCount = m[k].fallbackCount; return o; });
    }
    var byDay = {};
    logs.forEach(function (l) { var d = l.debutAt.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
    return {
      periodeDays: days, totalInterventions: logs.length,
      fallbackQrRate: logs.length ? logs.filter(function (l) { return l.fallbackQr; }).length / logs.length : 0,
      avgScoreConfiance: scored.length ? scored.reduce(function (s, l) { return s + l.scoreConfiance; }, 0) / scored.length : 0,
      byGroupe: group('userGroupe', 'groupe').map(function (g) { return { groupe: g.groupe, count: g.count }; }).sort(function (a, b) { return a.groupe < b.groupe ? -1 : 1; }),
      byClasse: (function () {
        var m = {};
        logs.forEach(function (l) { var k = l.classeDetectee || null; if (!k) return; m[k] = m[k] || { classe: k, count: 0, fallbackCount: 0 }; m[k].count++; if (l.fallbackQr) m[k].fallbackCount++; });
        return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.count - a.count; });
      })(),
      usageQuotidien: Object.keys(byDay).sort().map(function (d) { return { date: d, count: byDay[d] }; }),
      referentiel: { totalEquipements: equipements().length, totalGammes: gammes().filter(function (g) { return g.isActive; }).length, totalDocuments: documents().length }
    };
  });
  route('GET', /^\/kpi\/interventions$/, function (ctx) {
    var no = adminOnly(); if (no) return no;
    var q = ctx.query, days = Number(q.days) || 7, since = Date.now() - days * DAY, page = Number(q.page) || 1, size = Number(q.pageSize) || 50;
    var l = interventions().filter(function (x) { return Date.parse(x.debutAt) >= since && (!q.userId || x.userId === q.userId) && (!q.classe || x.classeDetectee === q.classe); })
      .sort(function (a, b) { return a.debutAt < b.debutAt ? 1 : -1; });
    return { total: l.length, page: page, pageSize: size, items: l.slice((page - 1) * size, page * size) };
  });

  /* ====================================================================== */
  /* 2. Noyau commun (identique sur tous les sites de démo)                 */
  /* ====================================================================== */

  function route(method, re, fn) { SITE.routes.push({ method: method, re: re, fn: fn }); }

  // État de démo persistant pour l'onglet (sessionStorage, repli en mémoire).
  var MEM = {};
  var S = {
    key: function (k) { return '__demo_' + SITE.name + '_' + k; },
    get: function (k, def) {
      try { var v = sessionStorage.getItem(S.key(k)); if (v != null) return JSON.parse(v); } catch (e) { if (S.key(k) in MEM) return MEM[S.key(k)]; }
      return def;
    },
    set: function (k, v) { MEM[S.key(k)] = v; try { sessionStorage.setItem(S.key(k), JSON.stringify(v)); } catch (e) { /* mémoire seule */ } }
  };

  function R(status, body, headers) { return { __r: true, status: status, body: body, headers: headers || {} }; }

  var DEMO = window.__DEMO_MOCK__ = { site: SITE.name, calls: [], blocked: [], R: R, S: S };
  var STATIC_HOSTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/i;

  function toURL(url) { try { return new URL(String(url), location.href); } catch (e) { return null; } }

  // 'pass' : ressource statique du site ou CDN public ; 'mock' : tout le reste.
  function classify(url) {
    var u = toURL(url);
    if (!u) return 'mock';
    if (u.protocol === 'data:' || u.protocol === 'blob:') return 'pass';
    if (u.origin === location.origin) return SITE.isApi(u) ? 'mock' : 'pass';
    if (STATIC_HOSTS.test(u.hostname) && !(SITE.isApi(u))) return 'pass';
    return 'mock';
  }

  function parseBody(b) {
    if (b == null) return null;
    if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) { return b; } }
    try {
      if (typeof FormData !== 'undefined' && b instanceof FormData) {
        var o = {}; b.forEach(function (v, k) { o[k] = (typeof File !== 'undefined' && v instanceof File) ? v.name : v; }); return o;
      }
      if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) {
        var q = {}; b.forEach(function (v, k) { q[k] = v; }); return q;
      }
    } catch (e) { /* ignore */ }
    return b;
  }

  function resolve(method, url, body, headers) {
    var u = toURL(url) || new URL(location.origin);
    var query = {};
    u.searchParams.forEach(function (v, k) { query[k] = v; });
    var ctx = { method: String(method || 'GET').toUpperCase(), url: u, path: u.pathname.replace(/^\/api(?=\/|$)/, '') || '/', query: query, body: parseBody(body), headers: headers || {} };
    var out;
    try {
      for (var i = 0; i < SITE.routes.length; i++) {
        var r = SITE.routes[i];
        if (r.method !== '*' && r.method !== ctx.method) continue;
        var m = ctx.path.match(r.re) || (u.href.match(r.re));
        if (!m) continue;
        ctx.params = m;
        out = r.fn(ctx);
        if (out !== undefined) break;
      }
    } catch (e) {
      try { console.warn('[démo] erreur du mock', ctx.method, ctx.path, e); } catch (e2) { /* ignore */ }
      out = undefined;
    }
    var matched = out !== undefined;
    if (!matched) out = SITE.fallback(ctx);
    var res = out && out.__r ? out : R(200, out);
    DEMO.calls.push({ method: ctx.method, url: u.href, status: res.status, matched: matched });
    return res;
  }

  function delay() { return SITE.delay ? SITE.delay() : 200 + Math.floor(Math.random() * 300); }

  function bodyText(res) {
    if (res.body === undefined || res.body === null) return res.status === 204 ? '' : 'null';
    return typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
  }
  function contentType(res) {
    return res.headers['content-type'] || (typeof res.body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');
  }
  var STATUS_TEXT = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };

  /* ---- fetch ---- */
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    init = init || {};
    var isReq = typeof Request !== 'undefined' && input instanceof Request;
    var url = isReq ? input.url : (input && input.href) || String(input);
    if (classify(url) === 'pass') return realFetch(input, init);
    var method = init.method || (isReq ? input.method : 'GET');
    var signal = init.signal || (isReq ? input.signal : null);
    var hdrs = {};
    try { new Headers(init.headers || (isReq ? input.headers : undefined)).forEach(function (v, k) { hdrs[k] = v; }); } catch (e) { /* ignore */ }
    var bodyP = init.body !== undefined ? Promise.resolve(init.body) : (isReq && method !== 'GET' && method !== 'HEAD' ? input.clone().text() : Promise.resolve(null));
    return bodyP.then(function (b) {
      return new Promise(function (ok, ko) {
        if (signal && signal.aborted) return ko(new DOMException('Aborted', 'AbortError'));
        var t = setTimeout(function () {
          var res = resolve(method, url, b, hdrs);
          if (res.stream) { ok(streamResponse(res, signal)); return; }
          var noBody = res.status === 204 || res.status === 304 || String(method).toUpperCase() === 'HEAD';
          var h = new Headers(res.headers); h.set('content-type', contentType(res));
          var resp = new Response(noBody ? null : bodyText(res), { status: res.status, statusText: STATUS_TEXT[res.status] || '', headers: h });
          try { Object.defineProperty(resp, 'url', { value: toURL(url).href }); } catch (e) { /* ignore */ }
          ok(resp);
        }, delay());
        if (signal) signal.addEventListener('abort', function () { clearTimeout(t); ko(new DOMException('Aborted', 'AbortError')); });
      });
    });
  };

  /* ---- Flux (text/event-stream) : res.stream = [{ wait: ms, data: objet|chaîne }] ---- */
  function streamResponse(res, signal) {
    var enc = new TextEncoder();
    var timers = [];
    var body = new ReadableStream({
      start: function (ctrl) {
        var t = 0, closed = false;
        function end(err) { if (closed) return; closed = true; timers.forEach(clearTimeout); try { if (err) ctrl.error(err); else ctrl.close(); } catch (e) { /* déjà fermé */ } }
        if (signal) signal.addEventListener('abort', function () { end(new DOMException('Aborted', 'AbortError')); });
        res.stream.forEach(function (ev) {
          t += ev.wait || 0;
          timers.push(setTimeout(function () {
            if (closed) return;
            if (typeof ev.run === 'function') { try { ev.run(); } catch (e) { /* ignore */ } }
            if (ev.data !== undefined) ctrl.enqueue(enc.encode('data: ' + (typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)) + String.fromCharCode(10, 10)));
          }, t));
        });
        timers.push(setTimeout(function () { end(); }, t + 10));
      },
      cancel: function () { timers.forEach(clearTimeout); }
    });
    var h = new Headers(res.headers); h.set('content-type', 'text/event-stream; charset=utf-8');
    return new Response(body, { status: res.status, headers: h });
  }

  /* ---- XMLHttpRequest (axios) ---- */
  var XP = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (XP) {
    var oOpen = XP.open, oSend = XP.send, oSet = XP.setRequestHeader, oAbort = XP.abort,
      oAll = XP.getAllResponseHeaders, oOne = XP.getResponseHeader, oMime = XP.overrideMimeType;
    var fire = function (xhr, type) {
      var ev;
      try { ev = type === 'readystatechange' ? new Event(type) : new ProgressEvent(type, { lengthComputable: false }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent(type, false, false); }
      xhr.dispatchEvent(ev);
    };
    var defineState = function (xhr, st) {
      ['readyState', 'status', 'statusText', 'responseText', 'response', 'responseURL', 'responseXML'].forEach(function (p) {
        Object.defineProperty(xhr, p, { configurable: true, get: function () { return st[p]; } });
      });
    };
    XP.open = function (method, url) {
      if (classify(url) === 'pass') { this.__demo = null; return oOpen.apply(this, arguments); }
      var st = { readyState: 1, status: 0, statusText: '', responseText: '', response: '', responseURL: '', responseXML: null };
      this.__demo = { method: method, url: url, headers: {}, st: st, aborted: false, timer: null, resHeaders: '' };
      defineState(this, st);
      fire(this, 'readystatechange');
    };
    XP.setRequestHeader = function (k, v) { if (this.__demo) { this.__demo.headers[String(k).toLowerCase()] = v; return; } return oSet.apply(this, arguments); };
    XP.overrideMimeType = function () { if (this.__demo) return; return oMime.apply(this, arguments); };
    XP.getAllResponseHeaders = function () { return this.__demo ? this.__demo.resHeaders : oAll.apply(this, arguments); };
    XP.getResponseHeader = function (name) {
      if (!this.__demo) return oOne.apply(this, arguments);
      var m = this.__demo.resHeaders.match(new RegExp('^' + String(name).replace(/[-]/g, '\\-') + ':\\s*(.*)$', 'im'));
      return m ? m[1].trim() : null;
    };
    XP.abort = function () {
      var d = this.__demo;
      if (!d) return oAbort.apply(this, arguments);
      d.aborted = true; clearTimeout(d.timer);
      d.st.readyState = 4; d.st.status = 0;
      fire(this, 'readystatechange'); fire(this, 'abort'); fire(this, 'loadend');
    };
    XP.send = function (body) {
      var d = this.__demo, xhr = this;
      if (!d) return oSend.apply(this, arguments);
      fire(xhr, 'loadstart');
      d.timer = setTimeout(function () {
        if (d.aborted) return;
        var res = resolve(d.method, d.url, body, d.headers);
        var text = bodyText(res);
        var st = d.st;
        var hdr = Object.assign({}, res.headers, { 'content-type': contentType(res) });
        d.resHeaders = Object.keys(hdr).map(function (k) { return k + ': ' + hdr[k]; }).join('\r\n') + '\r\n';
        st.status = res.status; st.statusText = STATUS_TEXT[res.status] || '';
        st.responseURL = (toURL(d.url) || {}).href || '';
        st.responseText = text;
        var rt = xhr.responseType;
        if (rt === 'json') { try { st.response = JSON.parse(text); } catch (e) { st.response = null; } }
        else if (rt === 'blob') st.response = new Blob([text], { type: hdr['content-type'] });
        else if (rt === 'arraybuffer') st.response = new TextEncoder().encode(text).buffer;
        else st.response = text;
        st.readyState = 2; fire(xhr, 'readystatechange');
        st.readyState = 3; fire(xhr, 'readystatechange');
        st.readyState = 4; fire(xhr, 'readystatechange');
        fire(xhr, 'load'); fire(xhr, 'loadend');
      }, delay());
    };
  }

  /* ---- WebSocket / EventSource : stubs qui n'ouvrent rien ---- */
  function makeStub(kind) {
    function Stub(url) {
      var et = new EventTarget();
      this._et = et;
      this.url = String(url); this.readyState = 0; this.protocol = ''; this.extensions = '';
      this.bufferedAmount = 0; this.binaryType = 'blob'; this.withCredentials = false;
      this.onopen = this.onmessage = this.onerror = this.onclose = null;
      DEMO.blocked.push(kind + ' ' + this.url);
    }
    Stub.prototype.addEventListener = function (t, f, o) { if (this._et) this._et.addEventListener(t, f, o); };
    Stub.prototype.removeEventListener = function (t, f, o) { if (this._et) this._et.removeEventListener(t, f, o); };
    Stub.prototype.dispatchEvent = function (e) { return this._et ? this._et.dispatchEvent(e) : true; };
    Stub.prototype.send = function () { /* rien n'est envoyé en démo */ };
    Stub.prototype.close = function () { this.readyState = kind === 'WebSocket' ? 3 : 2; };
    Stub.CONNECTING = 0; Stub.OPEN = 1; Stub.CLOSING = 2; Stub.CLOSED = kind === 'WebSocket' ? 3 : 2;
    return Stub;
  }
  window.WebSocket = makeStub('WebSocket');
  if (window.EventSource) window.EventSource = makeStub('EventSource');
  if (navigator.sendBeacon) {
    var oBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) { if (classify(url) === 'pass') return oBeacon(url, data); DEMO.blocked.push('beacon ' + url); return true; };
  }

  /* ---- Bandeau « Démo · données simulées » ---- */
  function banner() {
    if (document.getElementById('__demo-badge')) return;
    var b = document.createElement('div');
    b.id = '__demo-badge';
    b.setAttribute('role', 'note');
    b.textContent = SITE.badge || 'Démo · données simulées';
    var place = typeof SITE.badgeCss === 'function' ? SITE.badgeCss() : SITE.badgeCss;
    b.style.cssText = (place || 'left:10px;bottom:10px;') +'position:fixed;z-index:2147483000;pointer-events:none;' +
      'font:500 11px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.02em;' +
      'color:#f4f4f5;background:rgba(39,39,42,.78);padding:5px 9px;border-radius:999px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.18);opacity:.85';
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
})();
