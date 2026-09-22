/**
 * =========================================================
 * MEDIKIOSK — MODERN CLINICAL MEDICAL INTERACTIONS & 3D GRAPHICS
 * Theme: Emerald Green (#10b981) & Deep Mint (#059669)
 * Features:
 *   1. Custom Animated Medical Reticle & Hover Cursor
 *   2. Hero Section 3D DNA Genome Scanner
 *   3. 3D Holographic AI Nurse Assistant Avatar (Cursor-tracking & 360 Spin)
 *   4. Interactive 3D Card Tilt Physics & Triage Priority Dynamics
 *   5. Scroll Entrance & Real-time Telemetry Simulations
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  initCustomCursor();
  initHeroHeart3D();
  initNurseHologram3D();
  initInteractiveCardTilt();
  initScrollReveal();
  initNurseChatInteractions();
});

/* =========================================================
   1. ANIMATED CUSTOM MEDICAL CURSOR
========================================================= */
function initCustomCursor() {
  const cursor = document.getElementById("customCursor");
  if (!cursor) return;

  // Don't show custom cursor on touch-only devices
  if (window.matchMedia("(pointer: coarse)").matches) {
    cursor.style.display = "none";
    return;
  }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cursorX = mouseX;
  let cursorY = mouseY;
  let isHovered = false;
  let isVisible = false;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isVisible) {
      cursor.style.opacity = "1";
      isVisible = true;
    }
  });

  window.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget && !e.toElement) {
      cursor.style.opacity = "0";
      isVisible = false;
    }
  });

  // Smooth lerp tracking loop
  function renderCursor() {
    cursorX += (mouseX - cursorX) * 0.18;
    cursorY += (mouseY - cursorY) * 0.18;

    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    requestAnimationFrame(renderCursor);
  }
  requestAnimationFrame(renderCursor);

  // Interactive element hover detection
  const interactiveSelector = "a, button, .tilt-card, .vital-card, .triage-level, canvas, .nurse-action-pill, input";
  
  function attachHoverListeners() {
    const targets = document.querySelectorAll(interactiveSelector);
    targets.forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("cursor-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("cursor-hover"));
    });
  }
  attachHoverListeners();

  // Re-attach if DOM modifies
  const observer = new MutationObserver(attachHoverListeners);
  observer.observe(document.body, { childList: true, subtree: true });
}

/* =========================================================
   2. HERO SECTION 3D DNA GENOME SCANNER
========================================================= */
function initHeroHeart3D() {
  /* 3D DNA double helix with a diagnostic scan ring, floating medical crosses
     and a sonar-style pulse on a holographic base. */
  (function () {
    'use strict';

    var container = document.getElementById('hero3dContainer');
    var canvas = document.getElementById('heroHeartCanvas');
    if (!container || !canvas || !window.THREE) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      canvas.style.display = 'none';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    var EMERALD = 0x10b981;
    var CYAN = 0x22d3ee;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 16);

    /* ---------- lights ---------- */
    scene.add(new THREE.AmbientLight(0xbfffee, 0.55));
    var keyLight = new THREE.PointLight(0x34d399, 2.2, 45);
    keyLight.position.set(6, 5, 9);
    var rimLight = new THREE.PointLight(CYAN, 1.8, 45);
    rimLight.position.set(-7, -3, 5);
    scene.add(keyLight, rimLight);

    /* stage = tilt + mouse parallax for everything */
    var stage = new THREE.Group();
    stage.rotation.z = 0.2;
    scene.add(stage);

    /* ---------- DNA helix ---------- */
    var PAIRS = 34;
    var HEIGHT = 9;
    var RADIUS = 1.5;
    var TWIST = 0.52; // radians per base pair

    var helix = new THREE.Group();
    stage.add(helix);

    var nodeGeo = new THREE.SphereGeometry(0.19, 20, 20);
    var rungGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 8);
    var UP = new THREE.Vector3(0, 1, 0);
    var pairs = [];

    function glowMat(color) {
      return new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.2
      });
    }

    function addRung(from, to, mat) {
      var dir = new THREE.Vector3().subVectors(to, from);
      var len = dir.length();
      var mesh = new THREE.Mesh(rungGeo, mat);
      mesh.position.copy(from).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
      mesh.scale.set(1, len, 1);
      helix.add(mesh);
    }

    for (var i = 0; i < PAIRS; i++) {
      var t = i / (PAIRS - 1);
      var y = (t - 0.5) * HEIGHT;
      var a = i * TWIST;

      var A = new THREE.Vector3(Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS);
      var B = new THREE.Vector3(-A.x, y, -A.z);
      var C = new THREE.Vector3(0, y, 0);

      var matA = glowMat(EMERALD);
      var matB = glowMat(CYAN);

      var nodeA = new THREE.Mesh(nodeGeo, matA);
      var nodeB = new THREE.Mesh(nodeGeo, matB);
      nodeA.position.copy(A);
      nodeB.position.copy(B);
      helix.add(nodeA, nodeB);

      addRung(A, C, matA); // each half of the base pair takes its strand's colour
      addRung(B, C, matB);

      pairs.push({ y: y, matA: matA, matB: matB, nodeA: nodeA, nodeB: nodeB });
    }

    function addBackbone(sign, color) {
      var pts = [];
      var N = 180;
      for (var j = 0; j <= N; j++) {
        var tt = j / N;
        var ang = tt * (PAIRS - 1) * TWIST;
        pts.push(new THREE.Vector3(
          sign * Math.cos(ang) * RADIUS,
          (tt - 0.5) * HEIGHT,
          sign * Math.sin(ang) * RADIUS
        ));
      }
      var geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 360, 0.055, 8, false);
      var mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.3,
        transparent: true,
        opacity: 0.9
      });
      helix.add(new THREE.Mesh(geo, mat));
    }
    addBackbone(1, EMERALD);
    addBackbone(-1, CYAN);

    /* ---------- scan ring (sweeps up and down the helix) ---------- */
    var scanner = new THREE.Group();
    stage.add(scanner);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS + 1.1, 0.02, 8, 120),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = Math.PI / 2;

    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS + 1.1, 64),
      new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    disc.rotation.x = -Math.PI / 2;
    scanner.add(ring, disc);

    /* ---------- holographic base + sonar pulse ---------- */
    var base = new THREE.Group();
    base.position.y = -HEIGHT / 2 - 1.0;
    stage.add(base);

    [2.6, 3.4, 4.2].forEach(function (r, idx) {
      var m = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.025, 96),
        new THREE.MeshBasicMaterial({
          color: idx === 1 ? CYAN : EMERALD,
          transparent: true,
          opacity: 0.5 - idx * 0.12,
          side: THREE.DoubleSide
        })
      );
      m.rotation.x = -Math.PI / 2;
      base.add(m);
    });

    var pulseMat = new THREE.MeshBasicMaterial({
      color: EMERALD,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var pulse = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.55, 96), pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    base.add(pulse);

    /* ---------- floating medical crosses ---------- */
    function makeCross(size) {
      var g = new THREE.Group();
      var mat = new THREE.MeshStandardMaterial({
        color: EMERALD,
        emissive: EMERALD,
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85
      });
      var arm = new THREE.BoxGeometry(size, size * 0.32, size * 0.32);
      var h = new THREE.Mesh(arm, mat);
      var v = new THREE.Mesh(arm, mat);
      v.rotation.z = Math.PI / 2;
      g.add(h, v);
      return g;
    }

    var crosses = [
      { x: -3.8, y: 2.9,  z: -0.5, s: 0.9,  spin: 0.6,  phase: 0.0 },
      { x:  3.9, y: 1.2,  z:  0.8, s: 0.6,  spin: -0.8, phase: 1.7 },
      { x: -3.4, y: -2.6, z:  1.0, s: 0.55, spin: 0.9,  phase: 3.1 },
      { x:  3.6, y: -3.3, z: -1.0, s: 0.8,  spin: -0.5, phase: 4.6 }
    ].map(function (c) {
      var obj = makeCross(c.s);
      obj.position.set(c.x, c.y, c.z);
      stage.add(obj);
      c.obj = obj;
      return c;
    });

    /* ---------- ambient particles ---------- */
    var COUNT = 140;
    var pos = new Float32Array(COUNT * 3);
    for (var p = 0; p < COUNT; p++) {
      var r = 2.5 + Math.random() * 3.2;
      var th = Math.random() * Math.PI * 2;
      pos[p * 3]     = Math.cos(th) * r;
      pos[p * 3 + 1] = (Math.random() - 0.5) * 11;
      pos[p * 3 + 2] = Math.sin(th) * r;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.06,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    stage.add(particles);

    /* ---------- sizing ---------- */
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // pull the camera back on narrow containers so nothing is cropped
      camera.position.z = Math.max(16, 9.5 / (0.7279 * camera.aspect));
      camera.updateProjectionMatrix();
      if (reduced) render(2.2);
    }

    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(container);
    } else {
      window.addEventListener('resize', resize);
    }

    /* ---------- pointer parallax ---------- */
    var mouse = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    container.addEventListener('pointermove', function (e) {
      var b = container.getBoundingClientRect();
      target.x = (e.clientX - b.left) / b.width - 0.5;
      target.y = (e.clientY - b.top) / b.height - 0.5;
    });
    container.addEventListener('pointerleave', function () {
      target.x = 0;
      target.y = 0;
    });

    /* ---------- render ---------- */
    function render(t) {
      helix.rotation.y = t * 0.35;

      mouse.x += (target.x - mouse.x) * 0.05;
      mouse.y += (target.y - mouse.y) * 0.05;
      stage.rotation.y = mouse.x * 0.5;
      stage.rotation.x = mouse.y * 0.35;

      // scan ring sweeps the helix; base pairs light up as it passes
      var scanY = Math.sin(t * 0.8) * (HEIGHT / 2 + 0.3);
      scanner.position.y = scanY;
      for (var k = 0; k < pairs.length; k++) {
        var pr = pairs[k];
        var d = pr.y - scanY;
        var glow = Math.exp(-d * d * 1.4);
        var inten = 0.4 + glow * 2.0;
        pr.matA.emissiveIntensity = inten;
        pr.matB.emissiveIntensity = inten;
        var sc = 1 + glow * 0.6;
        pr.nodeA.scale.setScalar(sc);
        pr.nodeB.scale.setScalar(sc);
      }

      // sonar pulse on the base
      var phase = (t * 0.5) % 1;
      pulse.scale.setScalar(1 + phase * 0.9);
      pulseMat.opacity = 0.55 * (1 - phase);

      // floating crosses
      for (var c = 0; c < crosses.length; c++) {
        var cr = crosses[c];
        cr.obj.rotation.y = t * cr.spin;
        cr.obj.rotation.x = Math.sin(t * 0.5 + cr.phase) * 0.3;
        cr.obj.position.y = cr.y + Math.sin(t * 0.7 + cr.phase) * 0.25;
      }

      particles.rotation.y = t * 0.05;
      renderer.render(scene, camera);
    }

    /* ---------- loop (pauses when off-screen or tab hidden) ---------- */
    var clock = new THREE.Clock();
    var raf = 0;
    var inView = true;
    var tabVisible = !document.hidden;

    function loop() {
      raf = requestAnimationFrame(loop);
      render(clock.getElapsedTime());
    }
    function sync() {
      var shouldRun = inView && tabVisible && !reduced;
      if (shouldRun && !raf) loop();
      if (!shouldRun && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }).observe(container);
    }
    document.addEventListener('visibilitychange', function () {
      tabVisible = !document.hidden;
      sync();
    });

    resize();
    if (reduced) { render(2.2); } else { sync(); }
  })();
}

/* =========================================================
   3. AI NURSE ASSISTANT (3D HOLOGRAPHIC NURSE AVATAR)
========================================================= */
function initNurseHologram3D() {
  const canvas = document.getElementById("nurseHoloCanvas");
  if (!canvas || !window.THREE) return;

  const container = canvas.parentElement;
  let width = container.clientWidth;
  let height = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 5.8);

  // Ambient & Clinical Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const greenSpot = new THREE.PointLight(0x10b981, 3.2, 18);
  greenSpot.position.set(0, 2, 4);
  scene.add(greenSpot);

  const nurseGroup = new THREE.Group();
  scene.add(nurseGroup);

  // --- Holographic Nurse Head Orb ---
  const headGeo = new THREE.SphereGeometry(1.05, 32, 32);
  const headMat = new THREE.MeshPhysicalMaterial({
    color: 0x091e2b,
    metalness: 0.6,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  nurseGroup.add(headMesh);

  // Outer Holographic Aura Glow Shell
  const auraGeo = new THREE.SphereGeometry(1.2, 24, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    wireframe: true,
    transparent: true,
    opacity: 0.28
  });
  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  nurseGroup.add(auraMesh);

  // --- Biometric Sensor Visor with Cursor-Tracking Eyes ---
  const visorGroup = new THREE.Group();
  nurseGroup.add(visorGroup);

  const visorGeo = new THREE.CylinderGeometry(0.96, 0.96, 0.38, 32, 1, true, -Math.PI / 3, (Math.PI * 2) / 3);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.rotation.x = Math.PI / 2;
  visorGroup.add(visor);

  // Two Glowing Eye / Sensor Indicators
  const eyeGroup = new THREE.Group();
  visorGroup.add(eyeGroup);

  const eyeGeo = new THREE.SphereGeometry(0.11, 16, 16);
  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    boxShadow: "0 0 10px #10b981"
  });

  const eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
  eyeLeft.position.set(-0.32, 0.05, 0.98);
  eyeGroup.add(eyeLeft);

  const eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
  eyeRight.position.set(0.32, 0.05, 0.98);
  eyeGroup.add(eyeRight);

  // Glowing Concentric Halo Ring
  const haloGeo = new THREE.TorusGeometry(1.48, 0.02, 16, 70);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.6 });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = Math.PI / 2.3;
  nurseGroup.add(halo);

  // --- Interactive Cursor Tracking for Eyes & Visor ---
  let eyeTargetX = 0;
  let eyeTargetY = 0;
  let spinAngle = 0;
  let targetSpin = 0;

  window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    eyeTargetX = ((e.clientX - centerX) / window.innerWidth) * 0.7;
    eyeTargetY = -((e.clientY - centerY) / window.innerHeight) * 0.5;
  });

  // Hover Interaction: Trigger smooth 360-degree rotation & aura burst
  container.addEventListener("mouseenter", () => {
    targetSpin += Math.PI * 2;
    auraMat.opacity = 0.75;
    auraMat.color.setHex(0x34d399);
  });

  container.addEventListener("mouseleave", () => {
    auraMat.opacity = 0.28;
    auraMat.color.setHex(0x10b981);
  });

  // Animation Loop: Idle breathing effect + sensor eye tracking
  const clock = new THREE.Clock();

  function animateNurse() {
    requestAnimationFrame(animateNurse);
    const elapsed = clock.getElapsedTime();

    // 1. Idle breathing effect (subtle pulsing/scaling)
    const breath = 1.0 + Math.sin(elapsed * 2.2) * 0.035;
    headMesh.scale.set(breath, breath, breath);
    auraMesh.scale.set(breath * 1.02, breath * 1.02, breath * 1.02);

    // 2. Continuous levitation
    nurseGroup.position.y = Math.sin(elapsed * 1.8) * 0.15;

    // 3. Sensor indicators follow user cursor smoothly
    eyeGroup.position.x += (eyeTargetX - eyeGroup.position.x) * 0.1;
    eyeGroup.position.y += (eyeTargetY - eyeGroup.position.y) * 0.1;

    // 4. Smooth 360 spin on hover/interaction
    spinAngle += (targetSpin - spinAngle) * 0.08;
    nurseGroup.rotation.y = spinAngle + Math.sin(elapsed * 0.6) * 0.15;
    halo.rotation.z = elapsed * 0.4;

    renderer.render(scene, camera);
  }
  animateNurse();

  window.addEventListener("resize", () => {
    if (!canvas.parentElement) return;
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
}

/* =========================================================
   4. INTERACTIVE 3D CARD TILT DYNAMICS
========================================================= */
function initInteractiveCardTilt() {
  const cards = document.querySelectorAll(".tilt-card");

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate tilt angles (max 10 degrees)
      const rotateX = ((y - centerY) / centerY) * -9;
      const rotateY = ((x - centerX) / centerX) * 9;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.04, 1.04, 1.04)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    });
  });
}

/* =========================================================
   5. AI NURSE INTERACTIVE CHAT SIMULATION
========================================================= */
function initNurseChatInteractions() {
  const msgElement = document.getElementById("nurseChatMsg");
  const actionPills = document.querySelectorAll(".nurse-action-pill");
  if (!msgElement || !actionPills.length) return;

  const responses = {
    triage: "Running multi-system triage rules: Vital signs and red flags determine Priority (Emergency, Urgent, or Routine).",
    chest: "Chest discomfort flagged: Screening for radiation, diaphoresis, and SpO2. Recommending immediate ECG triage review.",
    home: "Syncing Node 2 (Home Care Hub): Bio-optical vitals & medication reminder compliance are up-to-date."
  };

  actionPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const action = pill.getAttribute("data-action");
      if (!responses[action]) return;

      const targetText = responses[action];
      typeWriter(msgElement, `"${targetText}"`);
    });
  });

  function typeWriter(element, text) {
    element.innerHTML = "";
    let i = 0;
    const speed = 20;

    function type() {
      if (i < text.length) {
        element.innerHTML += text.charAt(i);
        i++;
        setTimeout(type, speed);
      }
    }
    type();
  }
}

/* =========================================================
   6. SCROLL REVEAL (FADE-IN & SLIDE-UP ENTRANCE)
========================================================= */
function initScrollReveal() {
  const reveals = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  reveals.forEach((el) => observer.observe(el));
}
