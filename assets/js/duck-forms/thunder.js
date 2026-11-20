// Evolved forms WASTELAND (dieselpunk raider) and XIANXIA (thunder immortal).
// The models, materials and animation come from their standalone showcase page;
// the page's own panels are replaced by the small API returned at the end.
import { createOrbit, createPacer, fitStage, disposeStage } from "./stage.js";

export function createThunder(THREE, ctx) {
  // =========================================================================
  // 1. DETERMINISTIC LOW-POLY HELPERS, CANVAS TEXTURES & RETRO QUACK AUDIO
  // =========================================================================

  function createRng(seed = 2026) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * Deterministic vertex-welded low-poly facet perturbation.
   * Ensures shared vertices move together cleanly (watertight), then converts
   * or computes crisp flat normals so every surface feels handcrafted & rugged.
   */
  function jitterGeometry(geometry, amount = 0.028, seed = 42, scaleVec = null) {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = geo.attributes.position;
    const rng = createRng(seed);
    const bucketOffsets = new Map();

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const key = `${Math.round(x * 400)}_${Math.round(y * 400)}_${Math.round(z * 400)}`;
      let off = bucketOffsets.get(key);
      if (!off) {
        off = [
          (rng() - 0.5) * 2 * amount,
          (rng() - 0.5) * 2 * amount,
          (rng() - 0.5) * 2 * amount,
        ];
        bucketOffsets.set(key, off);
      }

      x += off[0];
      y += off[1];
      z += off[2];

      if (scaleVec) {
        x *= scaleVec.x;
        y *= scaleVec.y;
        z *= scaleVec.z;
      }
      pos.setXYZ(i, x, y, z);
    }

    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Generates a weathered wasteland yellow-black hazard iron texture.
   */
  function createWastelandHazardTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#1c1917';
    const w = 34;
    for (let i = -256; i < 512; i += w * 2) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + w, 0);
      ctx.lineTo(i + w - 256, 256);
      ctx.lineTo(i - 256, 256);
      ctx.closePath();
      ctx.fill();
    }
    // Rust grit speckles
    const rng = createRng(707);
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = rng() > 0.45 ? 'rgba(120, 53, 15, 0.35)' : 'rgba(28, 25, 23, 0.28)';
      ctx.fillRect(rng() * 256, rng() * 256, 3 + rng() * 14, 2 + rng() * 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates a crisp Daoist paper talisman texture (yellow paper + red geometric thunder rune).
   */
  function createTalismanTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fde047';
    ctx.fillRect(0, 0, 128, 256);

    // Aged paper border
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 108, 236);

    // Geometric Daoist thunder sigil strokes
    ctx.lineWidth = 7;
    ctx.lineCap = 'square';
    ctx.beginPath();
    // Top three dots / trident crown
    ctx.moveTo(34, 42); ctx.lineTo(94, 42);
    ctx.moveTo(64, 26); ctx.lineTo(64, 66);
    ctx.moveTo(42, 66); ctx.lineTo(86, 66);
    // Lightning zig-zag spine
    ctx.moveTo(78, 84);
    ctx.lineTo(42, 122);
    ctx.lineTo(84, 146);
    ctx.lineTo(38, 188);
    ctx.lineTo(86, 206);
    // Cross bars
    ctx.moveTo(34, 112); ctx.lineTo(94, 112);
    ctx.moveTo(34, 166); ctx.lineTo(94, 166);
    ctx.stroke();

    // Bottom seal square
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(50, 212, 28, 22);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates a Chinese Thunder Drum face texture (parchment + vermilion/gold thunder swirl).
   */
  function createDrumFaceTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(0, 0, 256, 256);

    // Outer crimson ring
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.stroke();

    // Inner gold ring
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 86, 0, Math.PI * 2);
    ctx.stroke();

    // Angular thunderbolt rune in center
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.moveTo(146, 54);
    ctx.lineTo(86, 134);
    ctx.lineTo(124, 134);
    ctx.lineTo(108, 202);
    ctx.lineTo(170, 118);
    ctx.lineTo(132, 118);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates a smooth vertical sky gradient dome texture for each theme.
   */
  function createSkyGradientTexture(topHex, midHex, bottomHex) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, topHex);
    grad.addColorStop(0.55, midHex);
    grad.addColorStop(1.0, bottomHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // =========================================================================
  // 2. MATERIAL PALETTE (STRICT FLAT-SHADED LOW-POLY FINISH)
  // =========================================================================

  const texHazard = createWastelandHazardTexture();
  const texTalisman = createTalismanTexture();
  const texDrumFace = createDrumFaceTexture();

  const MAT = {
    // Shared Iconic Rubber Duck Materials
    duckYellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.74, metalness: 0.04, flatShading: true }),
    duckYellowDeep: new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.78, metalness: 0.06, flatShading: true }),
    duckBill: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.70, metalness: 0.05, flatShading: true }),
    eyeWhite: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65, metalness: 0.02, flatShading: true }),
    eyeBlack: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.1, flatShading: true }),

    // Form 1: Wasteland Dieselpunk Materials
    scrapSteel: new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.76, metalness: 0.70, flatShading: true }),
    darkIron: new THREE.MeshStandardMaterial({ color: 0x262321, roughness: 0.80, metalness: 0.68, flatShading: true }),
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x33302e, roughness: 0.66, metalness: 0.78, flatShading: true }),
    rustDark: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88, metalness: 0.38, flatShading: true }),
    rustOrange: new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85, metalness: 0.34, flatShading: true }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.52, metalness: 0.82, flatShading: true }),
    copper: new THREE.MeshStandardMaterial({ color: 0xc26d38, roughness: 0.48, metalness: 0.86, flatShading: true }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.36, metalness: 0.88, flatShading: true }),
    nitroRed: new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.68, metalness: 0.35, flatShading: true }),
    rubberTread: new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.92, metalness: 0.12, flatShading: true }),
    hazardIron: new THREE.MeshStandardMaterial({ map: texHazard, roughness: 0.76, metalness: 0.32, flatShading: true }),
    goggleGlow: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0xf59e0b, emissiveIntensity: 1.9, roughness: 0.25, metalness: 0.2, flatShading: true }),
    wastelandCoilGlow: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0x22d3ee, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.2, flatShading: true }),
    flameOrange: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    flameBlue: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false }),
    smokePuff: new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95, metalness: 0.0, flatShading: true, transparent: true, opacity: 0.72 }),
    wastelandBolt: new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    wastelandBoltCyan: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false }),

    // Form 2: Xianxia Thunder Immortal Materials
    daoIndigo: new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.74, metalness: 0.16, flatShading: true }),
    daoIndigoLight: new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.72, metalness: 0.22, flatShading: true }),
    vermilion: new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.66, metalness: 0.22, flatShading: true }),
    antiqueGold: new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.44, metalness: 0.82, flatShading: true }),
    jade: new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.48, metalness: 0.28, flatShading: true }),
    celestialRibbon: new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x7f1d1d, emissiveIntensity: 0.35, roughness: 0.58, metalness: 0.15, flatShading: true, side: THREE.DoubleSide }),
    talismanMat: new THREE.MeshStandardMaterial({ map: texTalisman, roughness: 0.82, metalness: 0.02, flatShading: true, side: THREE.DoubleSide }),
    drumFaceMat: new THREE.MeshStandardMaterial({ map: texDrumFace, roughness: 0.76, metalness: 0.08, flatShading: true }),
    cloudDark: new THREE.MeshStandardMaterial({ color: 0x312e68, roughness: 0.84, metalness: 0.1, flatShading: true }),
    cloudMid: new THREE.MeshStandardMaterial({ color: 0x63599c, roughness: 0.80, metalness: 0.08, flatShading: true }),
    cloudTrim: new THREE.MeshStandardMaterial({ color: 0xd8b4fe, emissive: 0x6b21a8, emissiveIntensity: 0.35, roughness: 0.72, metalness: 0.12, flatShading: true }),
    sealGlow: new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 2.3, roughness: 0.25, metalness: 0.3, flatShading: true }),
    swordBladeGlow: new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x38bdf8, emissiveIntensity: 1.75, roughness: 0.22, metalness: 0.65, flatShading: true }),
    eyeSpiritGlint: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xc084fc, emissiveIntensity: 2.0, roughness: 0.2, flatShading: true }),
    xianxiaBoltViolet: new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false }),
    xianxiaBoltGold: new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    baguaGlow: new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    baguaGold: new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  };

  const wireframeMaterials = [
    MAT.duckYellow, MAT.duckYellowDeep, MAT.duckBill, MAT.eyeWhite, MAT.eyeBlack,
    MAT.scrapSteel, MAT.darkIron, MAT.gunmetal, MAT.rustDark, MAT.rustOrange,
    MAT.brass, MAT.copper, MAT.chrome, MAT.nitroRed, MAT.rubberTread, MAT.hazardIron,
    MAT.goggleGlow, MAT.wastelandCoilGlow,
    MAT.daoIndigo, MAT.daoIndigoLight, MAT.vermilion, MAT.antiqueGold, MAT.jade,
    MAT.celestialRibbon, MAT.talismanMat, MAT.drumFaceMat, MAT.cloudDark, MAT.cloudMid,
    MAT.cloudTrim, MAT.sealGlow, MAT.swordBladeGlow, MAT.eyeSpiritGlint,
  ];

  function makeMesh(geo, mat, name = '', cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    if (name) m.name = name;
    return m;
  }

  // =========================================================================
  // 3. SCENE, CAMERA, RENDERER & DUAL-THEME LIGHTING / ENVIRONMENTS
  // =========================================================================

  const container = ctx.container;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, ctx.width / ctx.height, 0.1, 120);
  const DEFAULT_CAM_POS = new THREE.Vector3(-4.5, 2.75, 5.5);
  const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1.38, 0.08);
  camera.position.copy(DEFAULT_CAM_POS);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const pace = createPacer(renderer);
  renderer.setSize(ctx.width, ctx.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  container.appendChild(renderer.domElement);

  const controls = createOrbit(THREE, camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 2.6;
  controls.maxDistance = 13.0;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.copy(DEFAULT_CAM_TARGET);
  controls.autoRotate = false;
  controls.autoRotateSpeed = 1.65;
  controls.update();

  // Gradient Sky Dome (switches texture smoothly per theme)
  const skyWastelandTex = createSkyGradientTexture('#160f0c', '#261710', '#382015');
  const skyXianxiaTex = createSkyGradientTexture('#090717', '#140c2b', '#221247');
  const skyDomeMat = new THREE.MeshBasicMaterial({ map: skyWastelandTex, side: THREE.BackSide, depthWrite: false });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(52, 16, 12), skyDomeMat);
  scene.add(skyDome);

  scene.fog = new THREE.FogExp2(0x211510, 0.032);

  // Core Lights (recolored dynamically per form)
  const hemiLight = new THREE.HemisphereLight(0xfbbf24, 0x1c1410, 0.78);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffd7a1, 2.55);
  keyLight.position.set(5.2, 8.2, 5.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 26;
  keyLight.shadow.camera.left = -5.5;
  keyLight.shadow.camera.right = 5.5;
  keyLight.shadow.camera.top = 5.5;
  keyLight.shadow.camera.bottom = -5.5;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight1 = new THREE.DirectionalLight(0xea580c, 2.3);
  rimLight1.position.set(-6.0, 4.2, -5.2);
  scene.add(rimLight1);

  const rimLight2 = new THREE.DirectionalLight(0xf59e0b, 1.0);
  rimLight2.position.set(4.5, 2.8, -5.0);
  scene.add(rimLight2);

  const accentPointLight = new THREE.PointLight(0xf97316, 2.2, 10, 1.5);
  accentPointLight.position.set(0, 1.4, -1.6);
  scene.add(accentPointLight);

  const flashLight = new THREE.PointLight(0xfef08a, 0, 16, 1.2);
  flashLight.position.set(0, 3.2, 1.4);
  scene.add(flashLight);

  // =========================================================================
  // 4. SHARED REUSABLE BASE RUBBER DUCK BUILDER
  // =========================================================================

  /**
   * Builds the unmistakable chunky, rough-faceted low-poly yellow rubber duck
   * core with articulated lower orange duck bill (for QUACK animation) and
   * toggleable classic orange webbed duck feet.
   */
  function createBaseDuck(options = {}) {
    const {
      seed = 100,
      showRightEye = true,
      xianxiaEyes = false,
      armoredClassicFeet = false,
    } = options;

    const rig = new THREE.Group();
    rig.name = 'DuckCoreRig';

    // --- Faceted Angular Duck Torso ---
    const torsoGeo = new THREE.IcosahedronGeometry(0.96, 1);
    const tPos = torsoGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      let x = tPos.getX(i);
      let y = tPos.getY(i);
      let z = tPos.getZ(i);
      z *= 1.36;
      x *= 0.96;
      y *= 0.85;
      if (z > 0.24) {
        y += 0.14 * (z / 1.3);
        x *= 0.93;
      }
      if (z < -0.35) {
        y += 0.30 * ((-z - 0.35) / 1.0);
        x *= 0.82;
      }
      if (y < -0.46) {
        y = -0.47 + (y + 0.46) * 0.28;
      }
      tPos.setXYZ(i, x, y, z);
    }
    const roughTorsoGeo = jitterGeometry(torsoGeo, 0.032, seed + 1);
    const torsoMesh = makeMesh(roughTorsoGeo, MAT.duckYellow, 'DuckTorso');
    torsoMesh.position.set(0, 0.18, 0);
    rig.add(torsoMesh);

    // --- Cute Upturned Low-Poly Duck Tail ---
    const tailGeo = jitterGeometry(new THREE.ConeGeometry(0.42, 0.72, 5), 0.02, seed + 2);
    const tailMain = makeMesh(tailGeo, MAT.duckYellow, 'DuckTail');
    tailMain.position.set(0, 0.54, -1.24);
    tailMain.rotation.x = -0.82;
    tailMain.scale.set(1.12, 1.0, 0.76);
    rig.add(tailMain);

    const tailTipGeo = jitterGeometry(new THREE.ConeGeometry(0.24, 0.42, 4), 0.015, seed + 3);
    const tailTip = makeMesh(tailTipGeo, MAT.duckYellowDeep, 'DuckTailTip');
    tailTip.position.set(0, 0.78, -1.46);
    tailTip.rotation.x = -0.58;
    rig.add(tailTip);

    // --- Chunky Neck ---
    const neckGeo = jitterGeometry(new THREE.CylinderGeometry(0.42, 0.54, 0.52, 7), 0.02, seed + 4);
    const neckMesh = makeMesh(neckGeo, MAT.duckYellow, 'DuckNeck');
    neckMesh.position.set(0, 0.74, 0.66);
    neckMesh.rotation.x = 0.15;
    rig.add(neckMesh);

    // --- Slightly Oversized Faceted Duck Head ---
    const headGroup = new THREE.Group();
    headGroup.name = 'DuckHeadGroup';
    headGroup.position.set(0, 1.18, 0.72);
    rig.add(headGroup);

    const headGeo = new THREE.IcosahedronGeometry(0.67, 1);
    const hPos = headGeo.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      let x = hPos.getX(i);
      let y = hPos.getY(i);
      let z = hPos.getZ(i);
      x *= 0.97;
      y *= 0.95;
      z *= 1.05;
      if (y < -0.24) x *= 1.07;
      hPos.setXYZ(i, x, y, z);
    }
    const roughHeadGeo = jitterGeometry(headGeo, 0.026, seed + 10);
    const headMesh = makeMesh(roughHeadGeo, MAT.duckYellow, 'DuckHead');
    headGroup.add(headMesh);

    // --- Wide Two-Part Flat Orange Duck Bill (Upper + Articulated Lower Jaw) ---
    const billGroup = new THREE.Group();
    billGroup.name = 'DuckBillGroup';
    billGroup.position.set(0, -0.11, 0.60);
    headGroup.add(billGroup);

    const upperShape = new THREE.Shape();
    upperShape.moveTo(-0.36, 0);
    upperShape.lineTo(0.36, 0);
    upperShape.lineTo(0.45, 0.40);
    upperShape.lineTo(0.24, 0.64);
    upperShape.lineTo(-0.24, 0.64);
    upperShape.lineTo(-0.45, 0.40);
    upperShape.closePath();

    const upperBillGeo = jitterGeometry(
      new THREE.ExtrudeGeometry(upperShape, { depth: 0.14, bevelEnabled: false }).rotateX(Math.PI / 2),
      0.014,
      seed + 11
    );
    const upperBill = makeMesh(upperBillGeo, MAT.duckBill, 'UpperDuckBill');
    upperBill.position.set(0, 0.11, -0.06);
    billGroup.add(upperBill);

    // Articulated Lower Jaw Pivot (rotates +X to snap open when quacking!)
    const lowerJawPivot = new THREE.Group();
    lowerJawPivot.name = 'LowerJawPivot';
    lowerJawPivot.position.set(0, -0.03, -0.04);
    billGroup.add(lowerJawPivot);

    const lowerShape = new THREE.Shape();
    lowerShape.moveTo(-0.30, 0);
    lowerShape.lineTo(0.30, 0);
    lowerShape.lineTo(0.36, 0.34);
    lowerShape.lineTo(0.18, 0.52);
    lowerShape.lineTo(-0.18, 0.52);
    lowerShape.lineTo(-0.36, 0.34);
    lowerShape.closePath();

    const lowerBillGeo = jitterGeometry(
      new THREE.ExtrudeGeometry(lowerShape, { depth: 0.10, bevelEnabled: false }).rotateX(Math.PI / 2),
      0.012,
      seed + 12
    );
    const lowerBill = makeMesh(lowerBillGeo, MAT.duckBill, 'LowerDuckBill');
    lowerBill.position.set(0, -0.01, 0.0);
    lowerJawPivot.add(lowerBill);

    // --- Slightly Unhinged Low-Poly Bead Eyes ---
    const eyeSides = showRightEye ? [1, -1] : [1];
    eyeSides.forEach((side) => {
      const eyeHolder = new THREE.Group();
      eyeHolder.name = side > 0 ? 'LeftBeadEye' : 'RightBeadEye';
      eyeHolder.position.set(side * 0.37, 0.16, 0.47);
      eyeHolder.rotation.y = side * 0.42;
      headGroup.add(eyeHolder);

      const sclera = makeMesh(new THREE.IcosahedronGeometry(0.155, 1), MAT.eyeWhite);
      sclera.scale.set(1.0, 1.06, 0.68);
      eyeHolder.add(sclera);

      const pupil = makeMesh(new THREE.IcosahedronGeometry(0.082, 1), MAT.eyeBlack);
      pupil.position.set(side * 0.018, xianxiaEyes ? 0.0 : 0.014, 0.082);
      pupil.scale.set(1.0, 1.0, 0.6);
      eyeHolder.add(pupil);

      const glint = makeMesh(
        new THREE.OctahedronGeometry(xianxiaEyes ? 0.036 : 0.028, 0),
        xianxiaEyes ? MAT.eyeSpiritGlint : MAT.eyeWhite
      );
      glint.position.set(-side * 0.022, 0.042, 0.125);
      eyeHolder.add(glint);

      // Deadpan / unhinged low-poly brow ridge
      const brow = makeMesh(new THREE.BoxGeometry(0.24, 0.055, 0.10), MAT.duckYellowDeep);
      brow.position.set(0, 0.15, 0.055);
      brow.rotation.z = xianxiaEyes ? -side * 0.06 : side * 0.20;
      eyeHolder.add(brow);
    });

    // --- Classic Webbed Orange Duck Feet (Shown when Treads / Cloud Base toggled OFF) ---
    const classicFeetGroup = new THREE.Group();
    classicFeetGroup.name = 'ClassicDuckFeet';
    classicFeetGroup.visible = false;
    rig.add(classicFeetGroup);

    [-1, 1].forEach((side) => {
      const footUnit = new THREE.Group();
      footUnit.position.set(side * 0.46, -0.34, 0.08);
      classicFeetGroup.add(footUnit);

      const ankle = makeMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.36, 6), MAT.duckBill);
      ankle.position.y = -0.15;
      footUnit.add(ankle);

      if (armoredClassicFeet) {
        const shinGuard = makeMesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), MAT.scrapSteel);
        shinGuard.position.y = -0.14;
        footUnit.add(shinGuard);
      }

      const webShape = new THREE.Shape();
      webShape.moveTo(-0.17, -0.18);
      webShape.lineTo(0.17, -0.18);
      webShape.lineTo(0.34, 0.36);
      webShape.lineTo(0.11, 0.28);
      webShape.lineTo(0.0, 0.44);
      webShape.lineTo(-0.11, 0.28);
      webShape.lineTo(-0.34, 0.36);
      webShape.closePath();

      const webGeo = jitterGeometry(
        new THREE.ExtrudeGeometry(webShape, { depth: 0.10, bevelEnabled: false }).rotateX(Math.PI / 2),
        0.012,
        seed + 30 + side
      );
      const footMesh = makeMesh(webGeo, MAT.duckBill, side < 0 ? 'RightWebbedFoot' : 'LeftWebbedFoot');
      footMesh.position.set(0, -0.28, 0.06);
      footMesh.rotation.y = side * 0.15;
      footUnit.add(footMesh);
    });

    return { rig, headGroup, lowerJawPivot, classicFeetGroup };
  }

  // =========================================================================
  // 5. PROCEDURAL LOW-POLY LIGHTNING BOLT UTILITY
  // =========================================================================

  const _boltSegGeo = new THREE.BoxGeometry(0.036, 0.036, 1.0);
  const _bA = new THREE.Vector3();
  const _bB = new THREE.Vector3();
  const _bMid = new THREE.Vector3();
  const _bDir = new THREE.Vector3();
  const _bUp = new THREE.Vector3(0, 0, 1);

  function createLightningBolt(parent, mat, segments = 7, name = 'LightningBolt') {
    const grp = new THREE.Group();
    grp.name = name;
    const segs = [];
    for (let i = 0; i < segments; i++) {
      const m = new THREE.Mesh(_boltSegGeo, mat);
      grp.add(m);
      segs.push(m);
    }
    parent.add(grp);
    return { grp, segs, segments, nextT: 0 };
  }

  function updateLightningBolt(bolt, startVec, endVec, jitter = 0.16, thickness = 1.0) {
    const n = bolt.segments;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(startVec, endVec, t);
      if (i > 0 && i < n) {
        p.x += (Math.random() - 0.5) * 2 * jitter;
        p.y += (Math.random() - 0.5) * 2 * jitter;
        p.z += (Math.random() - 0.5) * 2 * jitter;
      }
      pts.push(p);
    }
    for (let i = 0; i < n; i++) {
      _bA.copy(pts[i]);
      _bB.copy(pts[i + 1]);
      const d = _bA.distanceTo(_bB);
      _bMid.addVectors(_bA, _bB).multiplyScalar(0.5);
      _bDir.subVectors(_bB, _bA).normalize();
      const seg = bolt.segs[i];
      seg.position.copy(_bMid);
      seg.scale.set(thickness, thickness, Math.max(d, 0.01));
      seg.quaternion.setFromUnitVectors(_bUp, _bDir);
    }
  }

  // =========================================================================
  // 6. ENVIRONMENT GROUPS (WASTELAND SCRAPYARD & XIANXIA CELESTIAL ALTAR)
  // =========================================================================

  // --- Wasteland Environment ---
  const envWasteland = new THREE.Group();
  scene.add(envWasteland);

  // Cracked low-poly scrap-metal ground disc
  const wastelandDiscGeo = jitterGeometry(new THREE.CylinderGeometry(3.5, 3.8, 0.16, 12), 0.04, 801);
  const wastelandDisc = makeMesh(wastelandDiscGeo, MAT.darkIron, 'ScrapGroundDisc', false);
  wastelandDisc.position.y = -0.085;
  envWasteland.add(wastelandDisc);

  // Outer desert floor plane catching soft shadows
  const wastelandFloor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 24),
    new THREE.MeshStandardMaterial({ color: 0x1b130f, roughness: 0.96, metalness: 0.08, flatShading: true })
  );
  wastelandFloor.rotation.x = -Math.PI / 2;
  wastelandFloor.position.y = -0.01;
  wastelandFloor.receiveShadow = true;
  envWasteland.add(wastelandFloor);

  // Subtle rusty grid ring
  const wastelandGrid = new THREE.GridHelper(26, 26, 0xb45309, 0x3b261c);
  wastelandGrid.position.y = 0.004;
  wastelandGrid.material.transparent = true;
  wastelandGrid.material.opacity = 0.34;
  envWasteland.add(wastelandGrid);

  const scrapRing = new THREE.Mesh(
    new THREE.RingGeometry(2.35, 2.52, 12),
    new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.36, side: THREE.DoubleSide })
  );
  scrapRing.rotation.x = -Math.PI / 2;
  scrapRing.position.y = 0.008;
  envWasteland.add(scrapRing);

  // Low-poly scrap debris slabs around perimeter
  const rngEnv1 = createRng(809);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.25;
    const rad = 2.95 + rngEnv1() * 1.1;
    const slab = makeMesh(
      jitterGeometry(new THREE.BoxGeometry(0.45 + rngEnv1() * 0.4, 0.09, 0.32 + rngEnv1() * 0.3), 0.02, 820 + i),
      i % 2 === 0 ? MAT.rustDark : MAT.scrapSteel,
      `ScrapPlate_${i}`,
      false
    );
    slab.position.set(Math.cos(ang) * rad, 0.02, Math.sin(ang) * rad);
    slab.rotation.set((rngEnv1() - 0.5) * 0.15, ang + rngEnv1(), (rngEnv1() - 0.5) * 0.15);
    envWasteland.add(slab);
  }

  // Drifting low-poly ember cubes
  const wastelandEmbers = [];
  const emberGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(emberGeo, i % 3 === 0 ? MAT.wastelandBolt : MAT.flameOrange);
    const ang = Math.random() * Math.PI * 2;
    const rad = 0.8 + Math.random() * 4.5;
    m.position.set(Math.cos(ang) * rad, Math.random() * 4.2, Math.sin(ang) * rad);
    envWasteland.add(m);
    wastelandEmbers.push({
      mesh: m,
      vy: 0.45 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.4,
      vz: (Math.random() - 0.5) * 0.4,
      spin: 2 + Math.random() * 4,
    });
  }

  // --- Xianxia Environment ---
  const envXianxia = new THREE.Group();
  envXianxia.visible = false;
  scene.add(envXianxia);

  const xianxiaFloor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 24),
    new THREE.MeshStandardMaterial({ color: 0x0d0a1f, roughness: 0.92, metalness: 0.16, flatShading: true })
  );
  xianxiaFloor.rotation.x = -Math.PI / 2;
  xianxiaFloor.position.y = -0.01;
  xianxiaFloor.receiveShadow = true;
  envXianxia.add(xianxiaFloor);

  // Floating Low-Poly Geometric Bagua / Rune Ring beneath Xianxia Duck
  const baguaFloorGroup = new THREE.Group();
  baguaFloorGroup.position.y = 0.03;
  envXianxia.add(baguaFloorGroup);

  const outerBaguaRing = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.70, 8), MAT.baguaGold);
  outerBaguaRing.rotation.x = -Math.PI / 2;
  baguaFloorGroup.add(outerBaguaRing);

  const innerBaguaRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.88, 8), MAT.baguaGlow);
  innerBaguaRing.rotation.x = -Math.PI / 2;
  innerBaguaRing.rotation.z = Math.PI / 8;
  baguaFloorGroup.add(innerBaguaRing);

  // 8 Trigram geometric bar clusters around the octagon
  const trigramPatterns = [
    [1, 1, 1], [0, 0, 0], [1, 0, 1], [0, 1, 0],
    [1, 1, 0], [0, 0, 1], [1, 0, 0], [0, 1, 1],
  ];
  trigramPatterns.forEach((pat, idx) => {
    const ang = (idx / 8) * Math.PI * 2;
    const triGrp = new THREE.Group();
    triGrp.position.set(Math.cos(ang) * 2.22, 0.01, Math.sin(ang) * 2.22);
    triGrp.rotation.y = -ang + Math.PI / 2;
    baguaFloorGroup.add(triGrp);

    pat.forEach((solid, lineIdx) => {
      const zOff = (lineIdx - 1) * 0.12;
      if (solid) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.02, 0.055), MAT.baguaGold);
        bar.position.z = zOff;
        triGrp.add(bar);
      } else {
        [-0.16, 0.16].forEach((bx) => {
          const halfBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.055), MAT.baguaGlow);
          halfBar.position.set(bx, 0, zOff);
          triGrp.add(halfBar);
        });
      }
    });
  });

  // Drifting golden-violet spirit sparks
  const xianxiaSparks = [];
  const spiritGeo = new THREE.OctahedronGeometry(0.055, 0);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(spiritGeo, i % 2 === 0 ? MAT.xianxiaBoltGold : MAT.xianxiaBoltViolet);
    const ang = Math.random() * Math.PI * 2;
    const rad = 0.7 + Math.random() * 4.2;
    m.position.set(Math.cos(ang) * rad, Math.random() * 4.6, Math.sin(ang) * rad);
    envXianxia.add(m);
    xianxiaSparks.push({
      mesh: m,
      ang,
      rad,
      vy: 0.32 + Math.random() * 0.55,
      orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.4),
    });
  }

  // =========================================================================
  // 7. BUILD FORM 1: 废土狂雷 // WASTELAND RAIDER DUCK
  // =========================================================================

  const wastelandRoot = new THREE.Group();
  wastelandRoot.name = 'Duck_Wasteland_Thunder';
  scene.add(wastelandRoot);

  const wBase = createBaseDuck({
    seed: 100,
    showRightEye: false, // Right eye is covered by cracked brass welding goggle!
    xianxiaEyes: false,
    armoredClassicFeet: true,
  });
  wastelandRoot.add(wBase.rig);

  const WASTELAND_TREAD_Y = 0.96;
  const WASTELAND_FEET_Y = 0.72;
  wBase.rig.position.y = WASTELAND_TREAD_Y;

  // -------------------------------------------------------------------------
  // 7.1 WASTELAND SCRAP ARMOR, ROLL-CAGE, MOHAWK, GOGGLES & BUMPER (`wArmorGroup`)
  // -------------------------------------------------------------------------
  const wArmorGroup = new THREE.Group();
  wArmorGroup.name = 'WastelandScrapArmor';
  wBase.rig.add(wArmorGroup);

  const wHeadArmorGroup = new THREE.Group();
  wHeadArmorGroup.name = 'WastelandHeadGear';
  wBase.headGroup.add(wHeadArmorGroup);

  // Jagged Welded Iron Thunderbolt Mohawk Fin along the Crown
  const wBoltShape = new THREE.Shape();
  wBoltShape.moveTo(0.0, 0.0);
  wBoltShape.lineTo(0.46, 0.14);
  wBoltShape.lineTo(0.18, 0.30);
  wBoltShape.lineTo(0.68, 0.54);
  wBoltShape.lineTo(0.28, 0.60);
  wBoltShape.lineTo(0.58, 0.92);
  wBoltShape.lineTo(-0.08, 0.66);
  wBoltShape.lineTo(0.12, 0.46);
  wBoltShape.lineTo(-0.30, 0.24);
  wBoltShape.lineTo(-0.06, 0.12);
  wBoltShape.closePath();

  const wMohawkGeo = jitterGeometry(
    new THREE.ExtrudeGeometry(wBoltShape, { depth: 0.10, bevelEnabled: false }).center(),
    0.015,
    140
  );
  const wMohawk = makeMesh(wMohawkGeo, MAT.scrapSteel, 'WeldedIronThunderMohawk');
  wMohawk.position.set(0, 0.80, -0.04);
  wMohawk.rotation.y = Math.PI / 2;
  wMohawk.rotation.z = -0.18;
  wHeadArmorGroup.add(wMohawk);

  // Rusty welded weld-plate collar at mohawk base
  const mohawkPlate = makeMesh(new THREE.BoxGeometry(0.32, 0.08, 0.58), MAT.rustOrange);
  mohawkPlate.position.set(0, 0.61, -0.02);
  wHeadArmorGroup.add(mohawkPlate);

  // Asymmetric Cracked Brass & Iron Welding Goggles (Glowing lens over right eye -X)
  const goggleStrap = makeMesh(new THREE.TorusGeometry(0.66, 0.055, 5, 10), MAT.darkIron, 'GoggleStrap');
  goggleStrap.rotation.x = Math.PI / 2 - 0.14;
  goggleStrap.position.set(0, 0.17, 0.02);
  wHeadArmorGroup.add(goggleStrap);

  const rightGoggle = new THREE.Group();
  rightGoggle.name = 'RightWeldingGoggle';
  rightGoggle.position.set(-0.34, 0.16, 0.46);
  rightGoggle.rotation.y = -0.34;
  wHeadArmorGroup.add(rightGoggle);

  const goggleRim = makeMesh(new THREE.CylinderGeometry(0.21, 0.23, 0.20, 7), MAT.brass);
  goggleRim.rotation.x = Math.PI / 2;
  rightGoggle.add(goggleRim);

  const goggleGuard = makeMesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 7), MAT.darkIron);
  goggleGuard.rotation.x = Math.PI / 2;
  goggleGuard.position.z = 0.09;
  rightGoggle.add(goggleGuard);

  const goggleLens = makeMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 7), MAT.goggleGlow, 'GoggleLens');
  goggleLens.rotation.x = Math.PI / 2;
  goggleLens.position.z = 0.095;
  rightGoggle.add(goggleLens);

  // Cracked iron cross-wire across lens
  const crackBar = makeMesh(new THREE.BoxGeometry(0.28, 0.025, 0.03), MAT.darkIron);
  crackBar.position.set(0, 0.02, 0.13);
  crackBar.rotation.z = 0.52;
  rightGoggle.add(crackBar);

  // Left goggle lens flipped up onto forehead so classic unhinged bead eye stays exposed!
  const flippedGoggle = new THREE.Group();
  flippedGoggle.position.set(0.32, 0.48, 0.36);
  flippedGoggle.rotation.set(-0.62, 0.28, 0.18);
  wHeadArmorGroup.add(flippedGoggle);

  const flippedRim = makeMesh(new THREE.CylinderGeometry(0.16, 0.17, 0.14, 7), MAT.brass);
  flippedRim.rotation.x = Math.PI / 2;
  flippedGoggle.add(flippedRim);

  const flippedGlass = makeMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 7), MAT.scrapSteel);
  flippedGlass.rotation.x = Math.PI / 2;
  flippedGlass.position.z = 0.07;
  flippedGoggle.add(flippedGlass);

  // Bolted Spiked Steel Bumper / Grill Guard right underneath the orange duck bill
  const bumperGroup = new THREE.Group();
  bumperGroup.name = 'SpikedBillBumper';
  bumperGroup.position.set(0, -0.26, 0.80);
  wHeadArmorGroup.add(bumperGroup);

  const bumperBar = makeMesh(jitterGeometry(new THREE.BoxGeometry(0.84, 0.14, 0.18), 0.01, 145), MAT.scrapSteel);
  bumperGroup.add(bumperBar);

  const bumperTrim = makeMesh(new THREE.BoxGeometry(0.68, 0.08, 0.21), MAT.hazardIron);
  bumperTrim.position.y = -0.02;
  bumperGroup.add(bumperTrim);

  // 5 jagged steel bumper spikes
  for (let s = -2; s <= 2; s++) {
    const spike = makeMesh(new THREE.ConeGeometry(0.048, 0.20, 4), MAT.chrome);
    spike.rotation.x = Math.PI / 2;
    spike.position.set(s * 0.17, 0.0, 0.16);
    bumperGroup.add(spike);
  }

  // --- Torso Asymmetric Rusty Scrap-Steel Armor Plates & Rivets ---
  const scrapPlates = [
    { pos: [0, 0.12, 1.12], rot: [0.24, 0, 0.06], size: [0.92, 0.52, 0.14], mat: MAT.rustDark },
    { pos: [0.06, 0.36, 1.06], rot: [0.26, 0, -0.08], size: [0.68, 0.20, 0.16], mat: MAT.hazardIron },
    { pos: [0.96, 0.32, 0.28], rot: [0.05, 0.18, -0.24], size: [0.16, 0.62, 0.86], mat: MAT.scrapSteel },
    { pos: [-0.96, 0.28, 0.22], rot: [-0.08, -0.14, 0.28], size: [0.16, 0.56, 0.82], mat: MAT.rustOrange },
    { pos: [0.84, 0.50, -0.45], rot: [0.14, -0.22, -0.35], size: [0.14, 0.44, 0.62], mat: MAT.hazardIron },
    { pos: [-0.82, 0.46, -0.52], rot: [0.18, 0.25, 0.32], size: [0.14, 0.42, 0.58], mat: MAT.scrapSteel },
  ];
  scrapPlates.forEach((sp, idx) => {
    const pMesh = makeMesh(
      jitterGeometry(new THREE.BoxGeometry(...sp.size), 0.015, 160 + idx),
      sp.mat,
      `ScrapArmorPlate_${idx}`
    );
    pMesh.position.set(...sp.pos);
    pMesh.rotation.set(...sp.rot);
    wArmorGroup.add(pMesh);

    // Visible corner rivet studs
    [-0.32, 0.32].forEach((rx) => {
      const rivet = makeMesh(new THREE.OctahedronGeometry(0.032, 0), MAT.chrome);
      rivet.position.set(rx * sp.size[0], 0.32 * sp.size[1], sp.size[2] * 0.55);
      pMesh.add(rivet);
    });
  });

  // External Welded Dark-Iron Roll-Cage wrapping chest & flanks
  const cagePaths = [
    // Front chest bullbar arch
    [
      new THREE.Vector3(-0.76, -0.22, 0.92),
      new THREE.Vector3(-0.66, 0.46, 1.14),
      new THREE.Vector3(0.0, 0.56, 1.24),
      new THREE.Vector3(0.66, 0.46, 1.14),
      new THREE.Vector3(0.76, -0.22, 0.92),
    ],
    // Left side roll-cage rail
    [
      new THREE.Vector3(0.72, 0.44, 1.08),
      new THREE.Vector3(1.08, 0.52, 0.26),
      new THREE.Vector3(0.92, 0.62, -0.78),
      new THREE.Vector3(0.62, 0.14, -1.04),
    ],
    // Right side roll-cage rail
    [
      new THREE.Vector3(-0.72, 0.44, 1.08),
      new THREE.Vector3(-1.08, 0.52, 0.26),
      new THREE.Vector3(-0.92, 0.62, -0.78),
      new THREE.Vector3(-0.62, 0.14, -1.04),
    ],
  ];
  cagePaths.forEach((pts, idx) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = makeMesh(new THREE.TubeGeometry(curve, 10, 0.048, 5, false), MAT.darkIron, `RollCageBar_${idx}`);
    wArmorGroup.add(tube);
  });

  // -------------------------------------------------------------------------
  // 7.2 OVERSIZED V8 SUPERCHARGED ENGINE & COPPER TESLA COIL (`wEngineGroup`)
  // -------------------------------------------------------------------------
  const wEngineGroup = new THREE.Group();
  wEngineGroup.name = 'WastelandV8Engine';
  wEngineGroup.position.set(0, 0.84, -0.26);
  wBase.rig.add(wEngineGroup);

  // Main gunmetal V8 block
  const v8Block = makeMesh(jitterGeometry(new THREE.BoxGeometry(0.78, 0.52, 0.94), 0.014, 170), MAT.gunmetal, 'V8EngineBlock');
  wEngineGroup.add(v8Block);

  // Twin angled V-cylinder heads with rusty valve covers & bolt fins
  [-1, 1].forEach((side) => {
    const cylBank = new THREE.Group();
    cylBank.position.set(side * 0.38, 0.18, 0);
    cylBank.rotation.z = -side * 0.52;
    wEngineGroup.add(cylBank);

    const bankBody = makeMesh(new THREE.BoxGeometry(0.30, 0.34, 0.86), MAT.scrapSteel);
    cylBank.add(bankBody);

    const valveCover = makeMesh(new THREE.BoxGeometry(0.34, 0.12, 0.80), MAT.rustOrange);
    valveCover.position.y = 0.20;
    cylBank.add(valveCover);
  });

  // Top Blower Supercharger Scoop
  const blowerHousing = makeMesh(new THREE.BoxGeometry(0.54, 0.34, 0.72), MAT.chrome, 'SuperchargerBlower');
  blowerHousing.position.set(0, 0.46, 0.06);
  wEngineGroup.add(blowerHousing);

  const intakeScoop = makeMesh(new THREE.BoxGeometry(0.60, 0.24, 0.54), MAT.darkIron, 'SuperchargerScoop');
  intakeScoop.position.set(0, 0.72, 0.16);
  wEngineGroup.add(intakeScoop);

  // Glowing superheated intake butterfly flap inside scoop
  const intakeFlap = makeMesh(new THREE.BoxGeometry(0.46, 0.12, 0.06), MAT.rustOrange);
  intakeFlap.position.set(0, 0.72, 0.43);
  wEngineGroup.add(intakeFlap);

  // Animated Spinning Front Blower Pulleys & Belt
  const blowerGearTop = makeMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.10, 7), MAT.brass, 'BlowerGearTop');
  blowerGearTop.rotation.x = Math.PI / 2;
  blowerGearTop.position.set(0, 0.48, 0.48);
  wEngineGroup.add(blowerGearTop);

  const blowerGearBot = makeMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.10, 7), MAT.scrapSteel, 'BlowerGearBot');
  blowerGearBot.rotation.x = Math.PI / 2;
  blowerGearBot.position.set(0, 0.04, 0.50);
  wEngineGroup.add(blowerGearBot);

  const blowerBelt = makeMesh(new THREE.BoxGeometry(0.24, 0.52, 0.06), MAT.darkIron);
  blowerBelt.position.set(0, 0.26, 0.47);
  wEngineGroup.add(blowerBelt);

  // 4 Angled Soot-Stained Exhaust Pipes (2 left, 2 right) + Flame Cones
  const wExhaustTips = [];
  const wExhaustFlames = [];
  [-1, 1].forEach((side) => {
    [0.24, -0.22].forEach((zOff, idx) => {
      const pipeGrp = new THREE.Group();
      pipeGrp.position.set(side * 0.58, 0.34, zOff);
      pipeGrp.rotation.set(-0.36, 0, -side * 0.46);
      wEngineGroup.add(pipeGrp);

      const pipe = makeMesh(new THREE.CylinderGeometry(0.085, 0.11, 0.88, 6), idx === 0 ? MAT.darkIron : MAT.rustDark, `ExhaustPipe_${side}_${idx}`);
      pipe.position.y = 0.42;
      pipeGrp.add(pipe);

      // Sooty flared tip rim
      const rim = makeMesh(new THREE.CylinderGeometry(0.11, 0.09, 0.12, 6), MAT.scrapSteel);
      rim.position.y = 0.86;
      pipeGrp.add(rim);

      // Nitro / Fire Exhaust Flame Cone (toggled/scaled by animation)
      const flameGrp = new THREE.Group();
      flameGrp.position.set(0, 0.92, 0);
      pipeGrp.add(flameGrp);

      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.72, 5), MAT.flameOrange);
      outerFlame.position.y = 0.34;
      flameGrp.add(outerFlame);

      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.52, 5), MAT.flameBlue);
      innerFlame.position.y = 0.24;
      flameGrp.add(innerFlame);

      flameGrp.visible = false;
      wExhaustFlames.push({ grp: flameGrp, outer: outerFlame, inner: innerFlame });
      wExhaustTips.push(flameGrp);
    });
  });

  // Tall Crooked Copper Tesla Lightning-Rod Antenna on Rear of V8
  const teslaRodGroup = new THREE.Group();
  teslaRodGroup.name = 'CopperTeslaLightningRod';
  teslaRodGroup.position.set(0, 0.34, -0.64);
  teslaRodGroup.rotation.x = -0.28;
  wEngineGroup.add(teslaRodGroup);

  const rodBase = makeMesh(new THREE.CylinderGeometry(0.14, 0.18, 0.24, 6), MAT.darkIron);
  teslaRodGroup.add(rodBase);

  const rodLower = makeMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.74, 5), MAT.copper);
  rodLower.position.y = 0.42;
  teslaRodGroup.add(rodLower);

  // Crooked kinked upper rod segment
  const rodUpper = makeMesh(new THREE.CylinderGeometry(0.028, 0.045, 0.72, 5), MAT.copper);
  rodUpper.position.set(0.06, 1.04, -0.04);
  rodUpper.rotation.z = -0.18;
  teslaRodGroup.add(rodUpper);

  // Stacked copper Tesla torus coils
  [0.44, 0.62, 0.80].forEach((cy, idx) => {
    const coil = makeMesh(new THREE.TorusGeometry(0.16 - idx * 0.025, 0.036, 4, 7), MAT.copper);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(idx * 0.015, cy, 0);
    teslaRodGroup.add(coil);
  });

  // Glowing Tesla top emitter orb
  const teslaTipOrb = makeMesh(new THREE.IcosahedronGeometry(0.13, 0), MAT.wastelandCoilGlow, 'TeslaCoilTip');
  teslaTipOrb.position.set(0.13, 1.40, -0.06);
  teslaRodGroup.add(teslaTipOrb);

  // -------------------------------------------------------------------------
  // 7.3 HEAVY SPIKED TANK TREADS & HYDRAULIC STRUTS (`wTreadsGroup`)
  // -------------------------------------------------------------------------
  const wTreadsGroup = new THREE.Group();
  wTreadsGroup.name = 'WastelandTankTreads';
  wBase.rig.add(wTreadsGroup);

  // Rugged underbelly chassis beam
  const underChassis = makeMesh(jitterGeometry(new THREE.BoxGeometry(1.16, 0.24, 1.68), 0.014, 180), MAT.darkIron);
  underChassis.position.set(0, -0.44, 0.0);
  wTreadsGroup.add(underChassis);

  const wSpinningWheels = [];
  const wTreadCleats = [];

  [-1, 1].forEach((side) => {
    const pod = new THREE.Group();
    pod.name = side < 0 ? 'RightTankTread' : 'LeftTankTread';
    pod.position.set(side * 1.02, -0.58, 0.0);
    wTreadsGroup.add(pod);

    // Hydraulic suspension struts joining belly chassis to tread pod
    [0.48, -0.48].forEach((zOff) => {
      const strut = makeMesh(new THREE.CylinderGeometry(0.065, 0.075, 0.56, 5), MAT.chrome);
      strut.position.set(-side * 0.28, 0.16, zOff);
      strut.rotation.z = side * 0.85;
      pod.add(strut);

      const springCollar = makeMesh(new THREE.CylinderGeometry(0.10, 0.10, 0.22, 6), MAT.rustOrange);
      springCollar.position.set(-side * 0.28, 0.16, zOff);
      springCollar.rotation.z = side * 0.85;
      pod.add(springCollar);
    });

    // Armored side fender skirt over tread
    const fender = makeMesh(jitterGeometry(new THREE.BoxGeometry(0.56, 0.14, 1.98), 0.012, 185 + side), MAT.scrapSteel);
    fender.position.set(0, 0.40, 0);
    pod.add(fender);

    const fenderHazard = makeMesh(new THREE.BoxGeometry(0.58, 0.10, 0.72), MAT.hazardIron);
    fenderHazard.position.set(0, 0.34, 0.52);
    pod.add(fenderHazard);

    // Chunky Dark Rubber Tread Track Hull (rounded hexagon stadium shape)
    const trackShape = new THREE.Shape();
    trackShape.moveTo(-0.76, -0.34);
    trackShape.lineTo(0.76, -0.34);
    trackShape.lineTo(1.04, 0.0);
    trackShape.lineTo(0.76, 0.34);
    trackShape.lineTo(-0.76, 0.34);
    trackShape.lineTo(-1.04, 0.0);
    trackShape.closePath();

    const trackGeo = new THREE.ExtrudeGeometry(trackShape, { depth: 0.44, bevelEnabled: false });
    trackGeo.center();
    trackGeo.rotateY(Math.PI / 2);
    const trackHull = makeMesh(trackGeo, MAT.rubberTread, `TreadBelt_${side}`);
    pod.add(trackHull);

    // 3 Oversized Studded Scrap Road Wheels protruding slightly on outer flank
    [-0.68, 0.0, 0.68].forEach((wz, wIdx) => {
      const wheelGrp = new THREE.Group();
      wheelGrp.position.set(side * 0.22, 0.0, wz);
      pod.add(wheelGrp);

      const rim = makeMesh(new THREE.CylinderGeometry(0.29, 0.29, 0.14, 7), wIdx === 1 ? MAT.rustOrange : MAT.scrapSteel);
      rim.rotation.z = Math.PI / 2;
      wheelGrp.add(rim);

      const hub = makeMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.22, 6), MAT.brass);
      hub.rotation.z = Math.PI / 2;
      wheelGrp.add(hub);

      // Wheel lug spikes
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const lug = makeMesh(new THREE.ConeGeometry(0.036, 0.12, 4), MAT.chrome);
        lug.position.set(side * 0.08, Math.cos(a) * 0.18, Math.sin(a) * 0.18);
        lug.rotation.z = -side * Math.PI / 2;
        wheelGrp.add(lug);
      }
      wSpinningWheels.push(wheelGrp);
    });

    // Animated Spiked Tread Cleats circulating around the track perimeter
    const CLEAT_COUNT = 14;
    for (let c = 0; c < CLEAT_COUNT; c++) {
      const cleat = makeMesh(new THREE.BoxGeometry(0.50, 0.075, 0.11), c % 2 === 0 ? MAT.scrapSteel : MAT.rustDark);
      const spike = makeMesh(new THREE.ConeGeometry(0.035, 0.09, 4), MAT.chrome);
      spike.position.set(side * 0.16, 0.06, 0);
      cleat.add(spike);
      pod.add(cleat);
      wTreadCleats.push({ mesh: cleat, phase: c / CLEAT_COUNT });
    }
  });

  // Helper to position tank tread cleat along stadium path
  function positionCleatOnTrack(mesh, tNorm) {
    const t = ((tNorm % 1) + 1) % 1;
    // 4 segments: top, front arc, bottom, rear arc
    if (t < 0.32) {
      const u = t / 0.32;
      mesh.position.set(0, 0.35, -0.74 + u * 1.48);
      mesh.rotation.x = 0;
    } else if (t < 0.50) {
      const u = (t - 0.32) / 0.18;
      const ang = u * Math.PI;
      mesh.position.set(0, Math.cos(ang) * 0.35, 0.74 + Math.sin(ang) * 0.31);
      mesh.rotation.x = ang;
    } else if (t < 0.82) {
      const u = (t - 0.50) / 0.32;
      mesh.position.set(0, -0.35, 0.74 - u * 1.48);
      mesh.rotation.x = Math.PI;
    } else {
      const u = (t - 0.82) / 0.18;
      const ang = Math.PI + u * Math.PI;
      mesh.position.set(0, Math.cos(ang) * 0.35, -0.74 + Math.sin(ang) * 0.31);
      mesh.rotation.x = ang;
    }
  }

  // -------------------------------------------------------------------------
  // 7.4 SIDE ARMAMENTS: CHAINSAW HARPOON & NITRO CANISTERS (`wWeaponsGroup`)
  // -------------------------------------------------------------------------
  const wWeaponsGroup = new THREE.Group();
  wWeaponsGroup.name = 'WastelandSideArmaments';
  wBase.rig.add(wWeaponsGroup);

  // RIGHT FLANK (-X): Scrap Chainsaw-Blade / Harpoon Launcher
  const chainsawMount = new THREE.Group();
  chainsawMount.name = 'ScrapChainsawLauncher';
  chainsawMount.position.set(-1.14, 0.24, 0.28);
  wWeaponsGroup.add(chainsawMount);

  const csPylon = makeMesh(new THREE.BoxGeometry(0.38, 0.20, 0.28), MAT.darkIron);
  csPylon.position.set(0.14, 0.04, -0.06);
  chainsawMount.add(csPylon);

  const csMotorBody = makeMesh(jitterGeometry(new THREE.BoxGeometry(0.36, 0.36, 0.64), 0.012, 190), MAT.rustOrange);
  csMotorBody.position.set(-0.18, 0.0, 0.04);
  chainsawMount.add(csMotorBody);

  const csHazardGuard = makeMesh(new THREE.BoxGeometry(0.39, 0.14, 0.44), MAT.hazardIron);
  csHazardGuard.position.set(-0.18, 0.20, 0.04);
  chainsawMount.add(csHazardGuard);

  // Long Flat Saw Bar
  const sawBar = makeMesh(new THREE.BoxGeometry(0.08, 0.22, 1.18), MAT.scrapSteel, 'ChainsawBar');
  sawBar.position.set(-0.18, -0.02, 0.86);
  chainsawMount.add(sawBar);

  // Top Harpoon Spear Launcher Barrel
  const harpoonTube = makeMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.84, 6), MAT.gunmetal);
  harpoonTube.rotation.x = Math.PI / 2;
  harpoonTube.position.set(-0.18, 0.22, 0.62);
  chainsawMount.add(harpoonTube);

  const harpoonTip = makeMesh(new THREE.ConeGeometry(0.11, 0.34, 4), MAT.chrome, 'HarpoonSpearTip');
  harpoonTip.rotation.x = Math.PI / 2;
  harpoonTip.position.set(-0.18, 0.22, 1.18);
  chainsawMount.add(harpoonTip);

  // Animated Jagged Chainsaw Teeth circulating around the bar
  const wSawTeeth = [];
  const TOOTH_COUNT = 14;
  for (let i = 0; i < TOOTH_COUNT; i++) {
    const tooth = makeMesh(new THREE.ConeGeometry(0.045, 0.12, 3), MAT.chrome);
    chainsawMount.add(tooth);
    wSawTeeth.push({ mesh: tooth, phase: i / TOOTH_COUNT });
  }

  function updateSawToothPos(mesh, tNorm) {
    const t = ((tNorm % 1) + 1) % 1;
    const x = -0.18;
    if (t < 0.45) {
      const u = t / 0.45;
      mesh.position.set(x, 0.13, 0.34 + u * 1.04);
      mesh.rotation.set(0.35, 0, 0);
    } else if (t < 0.55) {
      const u = (t - 0.45) / 0.10;
      const a = u * Math.PI;
      mesh.position.set(x, -0.02 + Math.cos(a) * 0.15, 1.38 + Math.sin(a) * 0.15);
      mesh.rotation.set(a, 0, 0);
    } else {
      const u = (t - 0.55) / 0.45;
      mesh.position.set(x, -0.17, 1.38 - u * 1.04);
      mesh.rotation.set(Math.PI + 0.35, 0, 0);
    }
  }

  // LEFT FLANK (+X): Twin Strapped Red & Rusty Nitro Fuel Canisters + Pressure Pipes
  const nitroMount = new THREE.Group();
  nitroMount.name = 'TwinNitroCanisters';
  nitroMount.position.set(1.12, 0.28, -0.04);
  wWeaponsGroup.add(nitroMount);

  const nitroRack = makeMesh(new THREE.BoxGeometry(0.24, 0.42, 0.78), MAT.darkIron);
  nitroRack.position.x = -0.06;
  nitroMount.add(nitroRack);

  [0.24, -0.22].forEach((zPos, idx) => {
    const tank = new THREE.Group();
    tank.position.set(0.16, 0.04, zPos);
    tank.rotation.x = 0.22;
    nitroMount.add(tank);

    const cylinder = makeMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.72, 7), idx === 0 ? MAT.nitroRed : MAT.rustOrange, `NitroCanister_${idx}`);
    tank.add(cylinder);

    const capTop = makeMesh(new THREE.ConeGeometry(0.17, 0.16, 7), MAT.brass);
    capTop.position.y = 0.44;
    tank.add(capTop);

    const valve = makeMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 5), MAT.chrome);
    valve.position.y = 0.54;
    tank.add(valve);

    // Iron retaining straps
    [-0.18, 0.18].forEach((sy) => {
      const strap = makeMesh(new THREE.CylinderGeometry(0.185, 0.185, 0.06, 7), MAT.darkIron);
      strap.position.y = sy;
      tank.add(strap);
    });
  });

  // Pressure feed pipe curving from nitro canisters into V8 engine
  const nitroPipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.26, 0.74, 0.14),
    new THREE.Vector3(1.06, 1.08, -0.04),
    new THREE.Vector3(0.42, 1.04, -0.18),
  ]);
  const nitroPipe = makeMesh(new THREE.TubeGeometry(nitroPipeCurve, 8, 0.038, 5, false), MAT.copper, 'NitroFeedPipe');
  wWeaponsGroup.add(nitroPipe);

  // -------------------------------------------------------------------------
  // 7.5 WASTELAND LIGHTNING ARCS & BLOCKY EXHAUST SMOKE PUFFS (`wVfxGroup`)
  // -------------------------------------------------------------------------
  const wVfxGroup = new THREE.Group();
  wVfxGroup.name = 'WastelandLightningVFX';
  wBase.rig.add(wVfxGroup);

  const wLightningAnchors = [
    { a: new THREE.Vector3(0.12, 2.38, -1.26), b: new THREE.Vector3(0.0, 2.02, 0.66) },
    { a: new THREE.Vector3(0.12, 2.38, -1.26), b: new THREE.Vector3(-1.26, 0.44, 0.92) },
    { a: new THREE.Vector3(0.12, 2.38, -1.26), b: new THREE.Vector3(1.26, 0.72, 0.06) },
    { a: new THREE.Vector3(0.0, 1.56, -0.16), b: new THREE.Vector3(-0.78, 1.48, -0.58) },
    { a: new THREE.Vector3(0.0, 1.56, -0.16), b: new THREE.Vector3(0.78, 1.48, -0.58) },
  ];
  const wBolts = wLightningAnchors.map((anc, i) => ({
    ...createLightningBolt(wVfxGroup, i % 2 === 0 ? MAT.wastelandBolt : MAT.wastelandBoltCyan, 7, `WastelandBolt_${i}`),
    anc,
  }));

  // Blocky Low-Poly Exhaust Smoke Puffs
  const wSmokePuffs = [];
  const puffGeo = jitterGeometry(new THREE.IcosahedronGeometry(0.14, 0), 0.025, 199);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(puffGeo, MAT.smokePuff);
    m.visible = false;
    wVfxGroup.add(m);
    wSmokePuffs.push({
      mesh: m,
      pipeIdx: i % 4,
      life: (i / 16),
      driftX: (Math.random() - 0.5) * 0.5,
      driftZ: -0.4 - Math.random() * 0.5,
    });
  }

  // =========================================================================
  // 8. BUILD FORM 2: 九霄雷劫 // XIANXIA THUNDER IMMORTAL DUCK
  // =========================================================================

  const xianxiaRoot = new THREE.Group();
  xianxiaRoot.name = 'Duck_Xianxia_Thunder';
  xianxiaRoot.visible = false;
  scene.add(xianxiaRoot);

  const xBase = createBaseDuck({
    seed: 300,
    showRightEye: true,
    xianxiaEyes: true,
    armoredClassicFeet: false,
  });
  xianxiaRoot.add(xBase.rig);

  const XIANXIA_CLOUD_Y = 1.42;
  const XIANXIA_FEET_Y = 0.72;
  xBase.rig.position.y = XIANXIA_CLOUD_Y;

  // -------------------------------------------------------------------------
  // 8.1 DAOIST CROWN, LIGHTNING HORNS, FOREHEAD SEAL & TALISMAN (`xHeadGearGroup`)
  // -------------------------------------------------------------------------
  const xHeadGearGroup = new THREE.Group();
  xHeadGearGroup.name = 'XianxiaCrownAndTalisman';
  xBase.headGroup.add(xHeadGearGroup);

  // Angular Low-Poly Jade & Gold Daoist Crown (雷冠)
  const crownGroup = new THREE.Group();
  crownGroup.name = 'DaoistThunderCrown';
  crownGroup.position.set(0, 0.62, -0.02);
  xHeadGearGroup.add(crownGroup);

  const crownBase = makeMesh(new THREE.CylinderGeometry(0.28, 0.34, 0.24, 6), MAT.antiqueGold, 'CrownGoldBand');
  crownGroup.add(crownBase);

  const crownJadeCore = makeMesh(jitterGeometry(new THREE.CylinderGeometry(0.22, 0.25, 0.38, 6), 0.01, 310), MAT.jade, 'CrownJadeCore');
  crownJadeCore.position.y = 0.14;
  crownGroup.add(crownJadeCore);

  // Horizontal Jade Hairpin (玉簪) piercing the Daoist topknot crown
  const hairpin = makeMesh(new THREE.CylinderGeometry(0.032, 0.032, 1.18, 6), MAT.jade, 'JadeHairpin');
  hairpin.rotation.z = Math.PI / 2;
  hairpin.position.y = 0.18;
  crownGroup.add(hairpin);

  [-0.60, 0.60].forEach((hx) => {
    const cap = makeMesh(new THREE.OctahedronGeometry(0.075, 0), MAT.antiqueGold);
    cap.position.set(hx, 0.18, 0);
    crownGroup.add(cap);
  });

  // Twin Floating Golden Lightning Horns arching from crown
  const hornShape = new THREE.Shape();
  hornShape.moveTo(0, 0);
  hornShape.lineTo(0.22, 0.18);
  hornShape.lineTo(0.10, 0.28);
  hornShape.lineTo(0.36, 0.56);
  hornShape.lineTo(0.16, 0.44);
  hornShape.lineTo(-0.02, 0.24);
  hornShape.lineTo(0.08, 0.14);
  hornShape.closePath();
  const hornGeo = new THREE.ExtrudeGeometry(hornShape, { depth: 0.06, bevelEnabled: false }).center();

  const xFloatingHorns = [];
  [-1, 1].forEach((side) => {
    const horn = makeMesh(hornGeo, MAT.antiqueGold, side < 0 ? 'RightThunderHorn' : 'LeftThunderHorn');
    horn.scale.x = side;
    horn.position.set(side * 0.36, 0.44, 0.02);
    horn.rotation.z = -side * 0.22;
    crownGroup.add(horn);
    xFloatingHorns.push({ mesh: horn, baseY: 0.44, side });
  });

  // Glowing Vermilion-Gold Diamond Thunder Seal (雷印) hovering on forehead
  const foreheadSeal = new THREE.Group();
  foreheadSeal.name = 'ForeheadThunderSeal';
  foreheadSeal.position.set(0, 0.28, 0.72);
  xHeadGearGroup.add(foreheadSeal);

  const sealOuter = makeMesh(new THREE.OctahedronGeometry(0.11, 0), MAT.vermilion);
  sealOuter.scale.set(0.75, 1.35, 0.24);
  foreheadSeal.add(sealOuter);

  const sealInner = makeMesh(new THREE.OctahedronGeometry(0.075, 0), MAT.sealGlow);
  sealInner.scale.set(0.75, 1.35, 0.34);
  sealInner.position.z = 0.015;
  foreheadSeal.add(sealInner);

  // Quirky Low-Poly Fluttering Yellow Paper Talisman (符箓) hovering beside head
  const talismanPivot = new THREE.Group();
  talismanPivot.name = 'FloatingDaoistTalisman';
  talismanPivot.position.set(0.86, 0.22, 0.38);
  talismanPivot.rotation.set(0.08, -0.35, -0.14);
  xHeadGearGroup.add(talismanPivot);

  // 3 hinged paper segments for crisp low-poly flutter
  const talismanGeo = new THREE.BoxGeometry(0.32, 0.64, 0.018);
  const talismanMesh = makeMesh(talismanGeo, MAT.talismanMat, 'PaperTalisman');
  talismanPivot.add(talismanMesh);

  // -------------------------------------------------------------------------
  // 8.2 DAOIST ROBE PAULDRONS, BREASTPLATE & CELESTIAL RIBBON (`xRobeGroup`)
  // -------------------------------------------------------------------------
  const xRobeGroup = new THREE.Group();
  xRobeGroup.name = 'XianxiaDaoistRobe';
  xBase.rig.add(xRobeGroup);

  // Chest Daoist Breastplate with Geometric Gold Thunder Emblem
  const daoChest = makeMesh(jitterGeometry(new THREE.BoxGeometry(0.92, 0.56, 0.22), 0.014, 320), MAT.daoIndigo, 'DaoistBreastplate');
  daoChest.position.set(0, 0.14, 1.06);
  daoChest.rotation.x = 0.22;
  xRobeGroup.add(daoChest);

  const chestGoldFrame = makeMesh(new THREE.BoxGeometry(0.78, 0.44, 0.25), MAT.antiqueGold);
  chestGoldFrame.position.set(0, 0.14, 1.06);
  chestGoldFrame.rotation.x = 0.22;
  xRobeGroup.add(chestGoldFrame);

  const chestInner = makeMesh(new THREE.BoxGeometry(0.66, 0.34, 0.28), MAT.vermilion);
  chestInner.position.set(0, 0.14, 1.06);
  chestInner.rotation.x = 0.22;
  xRobeGroup.add(chestInner);

  const chestDiamond = makeMesh(new THREE.OctahedronGeometry(0.12, 0), MAT.sealGlow);
  chestDiamond.scale.set(1.0, 1.2, 0.35);
  chestDiamond.position.set(0, 0.15, 1.22);
  xRobeGroup.add(chestDiamond);

  // Origami-like Layered Angular Shoulder Pauldrons
  [-1, 1].forEach((side) => {
    const pGrp = new THREE.Group();
    pGrp.name = side < 0 ? 'RightDaoistPauldron' : 'LeftDaoistPauldron';
    pGrp.position.set(side * 0.96, 0.44, 0.22);
    pGrp.rotation.set(0.06, -side * 0.14, -side * 0.42);
    xRobeGroup.add(pGrp);

    const upperWing = makeMesh(jitterGeometry(new THREE.BoxGeometry(0.56, 0.14, 0.84), 0.012, 325 + side), MAT.daoIndigo);
    pGrp.add(upperWing);

    const goldRim = makeMesh(new THREE.BoxGeometry(0.60, 0.07, 0.88), MAT.antiqueGold);
    goldRim.position.y = 0.06;
    pGrp.add(goldRim);

    const lowerFlap = makeMesh(new THREE.BoxGeometry(0.44, 0.12, 0.70), MAT.vermilion);
    lowerFlap.position.set(side * 0.10, -0.14, -0.02);
    lowerFlap.rotation.z = -side * 0.25;
    pGrp.add(lowerFlap);
  });

  // Layered Waist Sash & Front Apron Banner
  const sashBand = makeMesh(new THREE.CylinderGeometry(0.96, 1.04, 0.26, 8), MAT.vermilion);
  sashBand.scale.set(1.0, 1.0, 1.32);
  sashBand.position.set(0, -0.16, 0.02);
  xRobeGroup.add(sashBand);

  const frontTabard = makeMesh(new THREE.BoxGeometry(0.46, 0.54, 0.07), MAT.daoIndigoLight);
  frontTabard.position.set(0, -0.34, 1.22);
  frontTabard.rotation.x = -0.18;
  xRobeGroup.add(frontTabard);

  const tabardTrim = makeMesh(new THREE.BoxGeometry(0.50, 0.08, 0.09), MAT.antiqueGold);
  tabardTrim.position.set(0, -0.58, 1.27);
  xRobeGroup.add(tabardTrim);

  // Sweeping Low-Poly Sculpted Celestial Ribbon (飘带 / 混天绫) arching over shoulders
  const ribbonGroup = new THREE.Group();
  ribbonGroup.name = 'CelestialRibbon';
  xRobeGroup.add(ribbonGroup);

  const ribbonPts = [
    new THREE.Vector3(-1.38, -0.18, -0.78),
    new THREE.Vector3(-1.42, 0.56, -0.28),
    new THREE.Vector3(-1.08, 1.18, 0.24),
    new THREE.Vector3(0.0, 1.32, 0.02),
    new THREE.Vector3(1.08, 1.18, 0.24),
    new THREE.Vector3(1.42, 0.56, -0.28),
    new THREE.Vector3(1.38, -0.18, -0.78),
  ];
  const ribbonCurve = new THREE.CatmullRomCurve3(ribbonPts);
  const ribbonSegs = 22;
  const ribbonW = 0.22;
  const rVerts = [];
  const rIndices = [];

  for (let i = 0; i <= ribbonSegs; i++) {
    const t = i / ribbonSegs;
    const pt = ribbonCurve.getPoint(t);
    const tan = ribbonCurve.getTangent(t);
    const sideDir = new THREE.Vector3(0, 0, 1).cross(tan).normalize();
    if (sideDir.lengthSq() < 0.01) sideDir.set(1, 0, 0);
    const taper = 0.55 + Math.sin(t * Math.PI) * 0.55;
    const p1 = pt.clone().addScaledVector(sideDir, ribbonW * taper);
    const p2 = pt.clone().addScaledVector(sideDir, -ribbonW * taper);
    rVerts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);

    if (i < ribbonSegs) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      rIndices.push(a, b, c, b, d, c);
    }
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(rVerts, 3));
  ribbonGeo.setIndex(rIndices);
  const flatRibbonGeo = ribbonGeo.toNonIndexed();
  flatRibbonGeo.computeVertexNormals();
  const ribbonMesh = makeMesh(flatRibbonGeo, MAT.celestialRibbon, 'HuntianlingRibbon');
  ribbonGroup.add(ribbonMesh);

  // Golden edge tips on ribbon ends
  [-1, 1].forEach((side) => {
    const tip = makeMesh(new THREE.OctahedronGeometry(0.10, 0), MAT.antiqueGold);
    tip.position.set(side * 1.38, -0.22, -0.82);
    ribbonGroup.add(tip);
  });

  // -------------------------------------------------------------------------
  // 8.3 BACK HALO: 6 THUNDER DRUMS & OCTAGONAL BAGUA DISC (`xDrumHaloGroup`)
  // -------------------------------------------------------------------------
  const xDrumHaloGroup = new THREE.Group();
  xDrumHaloGroup.name = 'ThunderDrumHaloArray';
  xDrumHaloGroup.position.set(0, 1.08, -1.24);
  xBase.rig.add(xDrumHaloGroup);

  // Rotating outer ring with 6 faceted Chinese Thunder Drums (雷鼓)
  const drumRingSpin = new THREE.Group();
  drumRingSpin.name = 'DrumRingSpinner';
  xDrumHaloGroup.add(drumRingSpin);

  const haloRadius = 1.56;
  const goldHaloRing = makeMesh(new THREE.TorusGeometry(haloRadius, 0.048, 5, 12), MAT.antiqueGold, 'HaloGoldRing');
  drumRingSpin.add(goldHaloRing);

  const xDrumPositions = [];
  for (let d = 0; d < 6; d++) {
    const ang = (d / 6) * Math.PI * 2 + Math.PI / 6;
    const dx = Math.cos(ang) * haloRadius;
    const dy = Math.sin(ang) * haloRadius;
    xDrumPositions.push(new THREE.Vector3(dx, dy, 0));

    const drumUnit = new THREE.Group();
    drumUnit.name = `ThunderDrum_${d}`;
    drumUnit.position.set(dx, dy, 0);
    drumUnit.rotation.z = ang;
    drumRingSpin.add(drumUnit);

    // Barrel body (chunky 8-sided vermilion cylinder)
    const barrel = makeMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.26, 8), MAT.vermilion);
    barrel.rotation.x = Math.PI / 2;
    drumUnit.add(barrel);

    // Gold rim bands
    [-0.10, 0.10].forEach((zRim) => {
      const band = makeMesh(new THREE.CylinderGeometry(0.30, 0.30, 0.045, 8), MAT.antiqueGold);
      band.rotation.x = Math.PI / 2;
      band.position.z = zRim;
      drumUnit.add(band);
    });

    // Front & Back parchment drum faces with thunder symbol texture
    [-0.135, 0.135].forEach((zFace) => {
      const face = makeMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 8), MAT.drumFaceMat);
      face.rotation.x = Math.PI / 2;
      face.position.z = zFace;
      drumUnit.add(face);
    });

    // Decorative golden stud spikes around drum shell
    for (let s = 0; s < 4; s++) {
      const sa = (s / 4) * Math.PI * 2;
      const stud = makeMesh(new THREE.OctahedronGeometry(0.04, 0), MAT.antiqueGold);
      stud.position.set(Math.cos(sa) * 0.31, Math.sin(sa) * 0.31, 0);
      drumUnit.add(stud);
    }
  }

  // Counter-rotating Central Octagonal Bagua Disc
  const baguaCenterSpin = new THREE.Group();
  baguaCenterSpin.name = 'BaguaDiscSpinner';
  xDrumHaloGroup.add(baguaCenterSpin);

  const baguaOct = makeMesh(new THREE.CylinderGeometry(0.76, 0.76, 0.08, 8), MAT.daoIndigo, 'CentralBaguaPlate');
  baguaOct.rotation.x = Math.PI / 2;
  baguaCenterSpin.add(baguaOct);

  const baguaRim = makeMesh(new THREE.TorusGeometry(0.76, 0.055, 4, 8), MAT.antiqueGold);
  baguaRim.rotation.z = Math.PI / 8;
  baguaCenterSpin.add(baguaRim);

  // Stylized low-poly Yin-Yang / Thunder Core emblem in center
  const coreHalf1 = makeMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.11, 6, 1, false, 0, Math.PI), MAT.sealGlow);
  coreHalf1.rotation.x = Math.PI / 2;
  baguaCenterSpin.add(coreHalf1);

  const coreHalf2 = makeMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.11, 6, 1, false, Math.PI, Math.PI), MAT.vermilion);
  coreHalf2.rotation.x = Math.PI / 2;
  baguaCenterSpin.add(coreHalf2);

  // Halo inter-drum lightning bolts (inside drumRingSpin so they rotate with the drums!)
  const xHaloBolts = [];
  for (let d = 0; d < 6; d++) {
    const next = (d + 1) % 6;
    const b = createLightningBolt(
      drumRingSpin,
      d % 2 === 0 ? MAT.xianxiaBoltViolet : MAT.xianxiaBoltGold,
      5,
      `HaloArc_${d}`
    );
    xHaloBolts.push({ ...b, a: xDrumPositions[d], b: xDrumPositions[next] });
  }

  // -------------------------------------------------------------------------
  // 8.4 SIX ORBITING CHINESE FLYING SWORDS (`xSwordsGroup`)
  // -------------------------------------------------------------------------
  const xSwordsGroup = new THREE.Group();
  xSwordsGroup.name = 'SixThunderFlyingSwords';
  xBase.rig.add(xSwordsGroup);

  const xFlyingSwords = [];
  for (let s = 0; s < 6; s++) {
    const swordPivot = new THREE.Group();
    swordPivot.name = `FlyingSword_${s}`;
    xSwordsGroup.add(swordPivot);

    const swordBody = new THREE.Group();
    swordPivot.add(swordBody);

    // Glowing Faceted Cyan-Violet Double-Edged Jian Blade (飞剑剑身)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.085, 0.12);
    bladeShape.lineTo(0.068, 1.18);
    bladeShape.lineTo(0, 1.46);
    bladeShape.lineTo(-0.068, 1.18);
    bladeShape.lineTo(-0.085, 0.12);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.036, bevelEnabled: false });
    bladeGeo.translate(0, 0, -0.018);
    const blade = makeMesh(bladeGeo, MAT.swordBladeGlow, `SwordBlade_${s}`);
    blade.rotation.x = Math.PI / 2; // Point blade forward along +Z
    swordBody.add(blade);

    // Ornate Golden Jian Crossguard (剑格)
    const guard = makeMesh(new THREE.BoxGeometry(0.28, 0.09, 0.11), MAT.antiqueGold);
    guard.position.z = 0.04;
    swordBody.add(guard);

    // Jade Hilt (玉柄)
    const hilt = makeMesh(new THREE.CylinderGeometry(0.042, 0.046, 0.34, 6), MAT.jade);
    hilt.rotation.x = Math.PI / 2;
    hilt.position.z = -0.18;
    swordBody.add(hilt);

    // Gold Pommel & Vermilion Sword Tassel
    const pommel = makeMesh(new THREE.OctahedronGeometry(0.068, 0), MAT.antiqueGold);
    pommel.position.z = -0.37;
    swordBody.add(pommel);

    const tassel = makeMesh(new THREE.ConeGeometry(0.045, 0.24, 4), MAT.vermilion);
    tassel.rotation.x = -Math.PI / 2;
    tassel.position.z = -0.52;
    swordBody.add(tassel);

    // Sword thrust energy flash cone (visible during SWORDS animation)
    const trailCone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.1, 4), MAT.xianxiaBoltViolet);
    trailCone.rotation.x = -Math.PI / 2;
    trailCone.position.z = -0.65;
    trailCone.visible = false;
    swordBody.add(trailCone);

    // Arrange 3 on left arc, 3 on right arc
    const side = s < 3 ? -1 : 1;
    const tier = s % 3; // 0 = low, 1 = mid, 2 = high
    const basePos = new THREE.Vector3(
      side * (1.58 + (tier === 1 ? 0.32 : 0.0)),
      -0.02 + tier * 0.62,
      -0.38 + (tier === 1 ? 0.22 : -0.10)
    );
    swordPivot.position.copy(basePos);

    xFlyingSwords.push({
      pivot: swordPivot,
      body: swordBody,
      trail: trailCone,
      basePos,
      side,
      tier,
      idx: s,
    });
  }

  // -------------------------------------------------------------------------
  // 8.5 SCULPTED CHUNKY LOW-POLY STORM CLOUD BASE (`xCloudBaseGroup`)
  // -------------------------------------------------------------------------
  const xCloudBaseGroup = new THREE.Group();
  xCloudBaseGroup.name = 'LowPolyThunderCloudBase';
  xCloudBaseGroup.position.set(0, -0.78, 0.0);
  xBase.rig.add(xCloudBaseGroup);

  const cloudPuffs = [
    { pos: [0.0, 0.02, 0.0], r: 0.78, scale: [1.38, 0.56, 1.46], mat: MAT.cloudDark },
    { pos: [0.76, -0.04, 0.38], r: 0.56, scale: [1.22, 0.62, 1.18], mat: MAT.cloudMid },
    { pos: [-0.76, -0.04, 0.36], r: 0.58, scale: [1.22, 0.62, 1.18], mat: MAT.cloudMid },
    { pos: [0.68, 0.06, -0.58], r: 0.54, scale: [1.20, 0.64, 1.15], mat: MAT.cloudMid },
    { pos: [-0.68, 0.06, -0.56], r: 0.54, scale: [1.18, 0.64, 1.18], mat: MAT.cloudDark },
    { pos: [0.0, -0.08, 0.88], r: 0.52, scale: [1.32, 0.54, 1.0], mat: MAT.cloudTrim },
    { pos: [0.0, 0.08, -0.94], r: 0.56, scale: [1.26, 0.60, 1.12], mat: MAT.cloudTrim },
    { pos: [1.12, -0.10, -0.14], r: 0.44, scale: [1.15, 0.54, 1.12], mat: MAT.cloudTrim },
    { pos: [-1.12, -0.10, -0.14], r: 0.44, scale: [1.15, 0.54, 1.12], mat: MAT.cloudTrim },
  ];
  cloudPuffs.forEach((cp, idx) => {
    const geo = jitterGeometry(new THREE.IcosahedronGeometry(cp.r, 1), 0.055, 360 + idx);
    const mesh = makeMesh(geo, cp.mat, `CloudCluster_${idx}`);
    mesh.position.set(...cp.pos);
    mesh.scale.set(...cp.scale);
    xCloudBaseGroup.add(mesh);
  });

  // Subtle glowing lavender-gold lightning core tucked under the storm cloud
  const cloudUnderGlow = makeMesh(new THREE.OctahedronGeometry(0.46, 0), MAT.sealGlow, 'CloudCoreGlow', false);
  cloudUnderGlow.scale.set(1.6, 0.38, 1.8);
  cloudUnderGlow.position.set(0, -0.28, 0);
  xCloudBaseGroup.add(cloudUnderGlow);

  // -------------------------------------------------------------------------
  // 8.6 SKY TRIBULATION LIGHTNING STRIKES (`xSkyLightningGroup`)
  // -------------------------------------------------------------------------
  const xSkyLightningGroup = new THREE.Group();
  xSkyLightningGroup.name = 'SkyTribulationLightning';
  xianxiaRoot.add(xSkyLightningGroup);

  const xSkyBolts = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.35;
    const rad = 1.65 + (i % 2) * 0.72;
    const b = createLightningBolt(
      xSkyLightningGroup,
      i % 2 === 0 ? MAT.xianxiaBoltViolet : MAT.xianxiaBoltGold,
      9,
      `SkyStrike_${i}`
    );
    b.grp.visible = false;
    xSkyBolts.push({
      ...b,
      baseX: Math.cos(ang) * rad,
      baseZ: Math.sin(ang) * rad,
    });
  }

  // =========================================================================
  // 9. MORPH & QUACK INSTANT BURST VFX (WORLD SPACE)
  // =========================================================================

  const burstVfxGroup = new THREE.Group();
  scene.add(burstVfxGroup);

  // Expanding low-poly shockwave ring
  const shockRingMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.92, 10), shockRingMat);
  shockRing.rotation.x = -Math.PI / 2;
  shockRing.position.y = 1.25;
  shockRing.visible = false;
  burstVfxGroup.add(shockRing);

  // 4 Radial burst bolts that fire during Morph or Quack!
  const burstBolts = [];
  for (let i = 0; i < 4; i++) {
    const b = createLightningBolt(burstVfxGroup, i % 2 === 0 ? MAT.wastelandBolt : MAT.xianxiaBoltViolet, 6, `BurstBolt_${i}`);
    b.grp.visible = false;
    burstBolts.push(b);
  }

  // =========================================================================
  // 10. STATE (every module stays equipped; the page picks form and animation)
  // =========================================================================

  const ANIMS = {
    wasteland: ['idle', 'charge', 'overload'],
    xianxia: ['idle', 'swords', 'tribulation'],
  };

  const state = {
    form: ctx.form, // 'wasteland' | 'xianxia'
    anim: { wasteland: 'idle', xianxia: 'idle' },
    modules: {
      wasteland: { v8Engine: true, treads: true, scrapArmor: true, weapons: true, lightningVfx: true },
      xianxia: { drumHalo: true, flyingSwords: true, daoistRobe: true, crownTalisman: true, cloudBase: true, skyLightning: true },
    },
    morphTimer: 0,
    quackTimer: 0,
  };

  let running = false;
  let frame = 0;

  /**
   * Shows the chosen form with its environment and lighting.
   */
  function syncSceneState() {
    const isW = state.form === 'wasteland';
    wastelandRoot.visible = isW;
    envWasteland.visible = isW;
    xianxiaRoot.visible = !isW;
    envXianxia.visible = !isW;

    // Wasteland modules
    const wm = state.modules.wasteland;
    wEngineGroup.visible = wm.v8Engine;
    wTreadsGroup.visible = wm.treads;
    wBase.classicFeetGroup.visible = !wm.treads;
    wArmorGroup.visible = wm.scrapArmor;
    wHeadArmorGroup.visible = wm.scrapArmor;
    wWeaponsGroup.visible = wm.weapons;
    wVfxGroup.visible = wm.lightningVfx;

    // Xianxia modules
    const xm = state.modules.xianxia;
    xDrumHaloGroup.visible = xm.drumHalo;
    xSwordsGroup.visible = xm.flyingSwords;
    xRobeGroup.visible = xm.daoistRobe;
    xHeadGearGroup.visible = xm.crownTalisman;
    xCloudBaseGroup.visible = xm.cloudBase;
    xBase.classicFeetGroup.visible = !xm.cloudBase;
    xSkyLightningGroup.visible = xm.skyLightning;

    // Lighting & Atmosphere Theme Switch
    if (isW) {
      skyDomeMat.map = skyWastelandTex;
      skyDomeMat.needsUpdate = true;
      scene.fog.color.setHex(0x211510);
      hemiLight.color.setHex(0xfbbf24);
      hemiLight.groundColor.setHex(0x1c1410);
      hemiLight.intensity = 0.80;
      keyLight.color.setHex(0xffd7a1);
      keyLight.intensity = 2.55;
      rimLight1.color.setHex(0xea580c);
      rimLight1.intensity = 2.4;
      rimLight2.color.setHex(0xf59e0b);
      rimLight2.intensity = 1.05;
      accentPointLight.color.setHex(0xf97316);
    } else {
      skyDomeMat.map = skyXianxiaTex;
      skyDomeMat.needsUpdate = true;
      scene.fog.color.setHex(0x110c26);
      hemiLight.color.setHex(0xc4b5fd);
      hemiLight.groundColor.setHex(0x0d0a1f);
      hemiLight.intensity = 0.88;
      keyLight.color.setHex(0xe0e7ff);
      keyLight.intensity = 2.35;
      rimLight1.color.setHex(0xa855f7);
      rimLight1.intensity = 2.6;
      rimLight2.color.setHex(0xfacc15);
      rimLight2.intensity = 1.65;
      accentPointLight.color.setHex(0xa855f7);
    }
  }

  /**
   * The electric burst that announces the evolved duck.
   */
  function triggerMorphBurst() {
    state.morphTimer = 0.26;
    shockRing.visible = true;
    shockRing.scale.setScalar(0.5);
    shockRingMat.color.setHex(state.form === 'wasteland' ? 0xfbbf24 : 0xc084fc);
    shockRingMat.opacity = 0.9;
    flashLight.color.setHex(state.form === 'wasteland' ? 0xf97316 : 0xa855f7);
    flashLight.intensity = 7.5;
  }

  /**
   * QUACK: squash-and-stretch bounce, lower bill snap and a radial lightning burst.
   */
  function triggerQuack() {
    state.quackTimer = 0.45;
    shockRing.visible = true;
    shockRing.scale.setScalar(0.4);
    shockRingMat.color.setHex(state.form === 'wasteland' ? 0xfacc15 : 0xe879f9);
    shockRingMat.opacity = 0.85;
    flashLight.color.setHex(state.form === 'wasteland' ? 0xfef08a : 0xc084fc);
    flashLight.intensity = 6.5;
  }

  // =========================================================================
  // 11. ANIMATION LOOP (ALL 6 FORM ANIMATIONS + MORPH + QUACK VFX)
  // =========================================================================

  const clock = new THREE.Clock();
  let elapsed = 0;
  let treadOffset = 0;
  let sawOffset = 0;
  const _tmpWorld = new THREE.Vector3();
  const _tmpLocal = new THREE.Vector3();

  syncSceneState();

  function animate() {
    if (!running) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    // -----------------------------------------------------------------------
    // A. MORPH & QUACK SHARED SQUASH-STRETCH + RADIAL LIGHTNING BURST
    // -----------------------------------------------------------------------
    let scaleX = 1, scaleY = 1, scaleZ = 1;
    let quackJawAngle = 0;

    if (state.morphTimer > 0) {
      state.morphTimer = Math.max(0, state.morphTimer - dt);
      const p = 1 - state.morphTimer / 0.26;
      const punch = Math.sin(p * Math.PI);
      scaleX = 1 + punch * 0.14;
      scaleY = 1 - punch * 0.10;
      scaleZ = 1 + punch * 0.14;

      shockRing.scale.setScalar(0.5 + p * 3.4);
      shockRingMat.opacity = (1 - p) * 0.85;
      if (state.morphTimer === 0) shockRing.visible = false;
    }

    if (state.quackTimer > 0) {
      state.quackTimer = Math.max(0, state.quackTimer - dt);
      const p = 1 - state.quackTimer / 0.45;
      // Squash-and-stretch bounce curve
      const bounce = Math.sin(p * Math.PI * 2.5) * (1 - p);
      scaleY *= 1 + bounce * 0.22;
      scaleX *= 1 - bounce * 0.12;
      scaleZ *= 1 - bounce * 0.12;
      // Snap lower orange bill wide open & shut
      quackJawAngle = Math.sin(Math.min(1, p * 1.45) * Math.PI) * 0.58;

      shockRing.scale.setScalar(0.4 + p * 3.2);
      shockRingMat.opacity = (1 - p) * 0.80;
      if (state.quackTimer === 0 && state.morphTimer === 0) shockRing.visible = false;
    }

    const burstActive = state.morphTimer > 0 || state.quackTimer > 0.12;
    burstBolts.forEach((b, i) => {
      b.grp.visible = burstActive;
      if (burstActive) {
        const ang = (i / 4) * Math.PI * 2 + elapsed * 14;
        updateLightningBolt(
          b,
          new THREE.Vector3(0, 1.5, 0),
          new THREE.Vector3(Math.cos(ang) * 2.3, 0.8 + (i % 2) * 1.3, Math.sin(ang) * 2.3),
          0.22,
          1.35
        );
      }
    });

    flashLight.intensity = THREE.MathUtils.lerp(flashLight.intensity, 0, 0.16);

    // -----------------------------------------------------------------------
    // B. FORM 1 ANIMATION: 废土狂雷 // WASTELAND RAIDER DUCK
    // -----------------------------------------------------------------------
    if (state.form === 'wasteland') {
      const mode = state.anim.wasteland;
      const baseH = state.modules.wasteland.treads ? WASTELAND_TREAD_Y : WASTELAND_FEET_Y;

      let rumbleY = 0, pitchX = 0, rollZ = 0;
      let wheelSpeed = 0, sawSpeed = 0.35, blowerSpeed = 4.5;
      let exhaustIntensity = 0.0;
      let jawTarget = quackJawAngle;

      if (mode === 'idle') {
        // Heavy rhythmic V8 idle vibration
        rumbleY = Math.sin(elapsed * 26) * 0.014 + Math.sin(elapsed * 7) * 0.012;
        pitchX = Math.sin(elapsed * 13) * 0.012;
        rollZ = Math.sin(elapsed * 26) * 0.015;
        wheelSpeed = 0;
        sawSpeed = 0.35;
        blowerSpeed = 5.5;
        exhaustIntensity = 0.15;
        wBase.headGroup.rotation.y = THREE.MathUtils.lerp(wBase.headGroup.rotation.y, Math.sin(elapsed * 1.2) * 0.24, 0.08);
        wBase.headGroup.rotation.x = THREE.MathUtils.lerp(wBase.headGroup.rotation.x, 0, 0.1);
      } else if (mode === 'charge') {
        // Aggressive dune-charging nitro boost!
        rumbleY = Math.abs(Math.sin(elapsed * 11.5)) * 0.14 + Math.sin(elapsed * 32) * 0.015;
        pitchX = 0.16 + Math.sin(elapsed * 11.5) * 0.06;
        rollZ = Math.sin(elapsed * 5.75) * 0.055;
        wheelSpeed = 9.5;
        sawSpeed = 4.2;
        blowerSpeed = 22.0;
        exhaustIntensity = 1.0;
        wBase.headGroup.rotation.y = THREE.MathUtils.lerp(wBase.headGroup.rotation.y, Math.sin(elapsed * 3.0) * 0.08, 0.12);
        wBase.headGroup.rotation.x = THREE.MathUtils.lerp(wBase.headGroup.rotation.x, -0.10, 0.12);

        // Scroll ground grid backward for high-speed feel
        wastelandGrid.position.z = (wastelandGrid.position.z - dt * 5.2) % 1.0;
      } else if (mode === 'overload') {
        // Rears back roaring with superheated coil & whipping wasteland thunder!
        rumbleY = 0.10 + (Math.random() - 0.5) * 0.03;
        pitchX = -0.20 + Math.sin(elapsed * 20) * 0.025;
        rollZ = (Math.random() - 0.5) * 0.04;
        wheelSpeed = 2.4;
        sawSpeed = 5.8;
        blowerSpeed = 30.0;
        exhaustIntensity = 0.85;
        jawTarget = Math.max(quackJawAngle, 0.42 + Math.sin(elapsed * 18) * 0.08);
        wBase.headGroup.rotation.y = THREE.MathUtils.lerp(wBase.headGroup.rotation.y, Math.sin(elapsed * 4.5) * 0.18, 0.14);
        wBase.headGroup.rotation.x = THREE.MathUtils.lerp(wBase.headGroup.rotation.x, -0.16, 0.14);
      }

      wBase.rig.position.y = THREE.MathUtils.lerp(wBase.rig.position.y, baseH + rumbleY, 0.22);
      wBase.rig.rotation.x = THREE.MathUtils.lerp(wBase.rig.rotation.x, pitchX, 0.16);
      wBase.rig.rotation.z = THREE.MathUtils.lerp(wBase.rig.rotation.z, rollZ, 0.18);
      wBase.rig.scale.set(scaleX, scaleY, scaleZ);
      wBase.lowerJawPivot.rotation.x = THREE.MathUtils.lerp(wBase.lowerJawPivot.rotation.x, jawTarget, 0.32);

      // Spin V8 blower pulleys
      blowerGearTop.rotation.y += blowerSpeed * dt;
      blowerGearBot.rotation.y -= blowerSpeed * 0.8 * dt;

      // Spin wheels & circulate tank tread cleats
      wSpinningWheels.forEach((w) => (w.rotation.x += wheelSpeed * dt));
      treadOffset += wheelSpeed * 0.12 * dt;
      wTreadCleats.forEach((c) => positionCleatOnTrack(c.mesh, c.phase + treadOffset));

      // Circulate chainsaw teeth
      sawOffset += sawSpeed * dt;
      wSawTeeth.forEach((t) => updateSawToothPos(t.mesh, t.phase + sawOffset));

      // Exhaust Flames
      const showFlames = state.modules.wasteland.v8Engine && state.modules.wasteland.lightningVfx && exhaustIntensity > 0.3;
      wExhaustFlames.forEach((f, idx) => {
        f.grp.visible = showFlames;
        if (showFlames) {
          const flicker = 0.78 + Math.sin(elapsed * 42 + idx * 1.9) * 0.30 + Math.random() * 0.18;
          f.outer.scale.set(1.0, flicker * (mode === 'charge' ? 1.45 : 1.05), 1.0);
          f.inner.scale.set(1.0, flicker * (mode === 'charge' ? 1.55 : 0.85), 1.0);
        }
      });

      // Superheated Tesla Coil Glow
      MAT.wastelandCoilGlow.emissiveIntensity = mode === 'overload' ? 3.4 + Math.sin(elapsed * 28) * 0.8 : 1.7;
      accentPointLight.intensity = mode === 'overload' ? 4.0 : mode === 'charge' ? 3.0 : 1.8;

      // Wasteland Lightning Bolts & Blocky Smoke Puffs
      if (state.modules.wasteland.lightningVfx) {
        const boltRate = mode === 'overload' ? 0.045 : mode === 'charge' ? 0.10 : 0.22;
        const boltChance = mode === 'overload' ? 0.94 : mode === 'charge' ? 0.56 : 0.34;
        wBolts.forEach((b, idx) => {
          if (!state.modules.wasteland.v8Engine && idx < 3) {
            b.grp.visible = false;
            return;
          }
          if (elapsed >= b.nextT) {
            b.nextT = elapsed + boltRate * (0.6 + Math.random() * 0.8);
            const active = Math.random() < boltChance;
            b.grp.visible = active;
            if (active) {
              updateLightningBolt(b, b.anc.a, b.anc.b, mode === 'overload' ? 0.22 : 0.13, mode === 'overload' ? 1.3 : 0.88);
            }
          }
        });

        // Blocky Exhaust Smoke Puffs rising from exhaust tips
        const smokeSpeed = mode === 'overload' ? 2.1 : mode === 'charge' ? 1.8 : 0.72;
        wSmokePuffs.forEach((p) => {
          if (!state.modules.wasteland.v8Engine) {
            p.mesh.visible = false;
            return;
          }
          p.life += dt * smokeSpeed;
          if (p.life >= 1.0) {
            p.life -= 1.0;
            const tipObj = wExhaustTips[p.pipeIdx];
            tipObj.getWorldPosition(_tmpWorld);
            _tmpLocal.copy(_tmpWorld);
            wBase.rig.worldToLocal(_tmpLocal);
            p.mesh.position.copy(_tmpLocal);
          }
          p.mesh.visible = true;
          p.mesh.position.y += dt * (1.2 + smokeSpeed * 0.45);
          p.mesh.position.x += p.driftX * dt;
          p.mesh.position.z += (mode === 'charge' ? -2.4 : p.driftZ) * dt;
          p.mesh.rotation.x += dt * 2.5;
          p.mesh.rotation.y += dt * 2.0;
          const sc = (0.38 + p.life * 1.15) * (1 - Math.max(0, (p.life - 0.7) / 0.3));
          p.mesh.scale.setScalar(Math.max(0.01, sc));
        });
      }

      // Drifting Wasteland Ember Cubes
      wastelandEmbers.forEach((em) => {
        em.mesh.position.y += em.vy * dt * (mode === 'overload' ? 2.0 : 1.0);
        em.mesh.position.x += em.vx * dt;
        em.mesh.position.z += (mode === 'charge' ? -3.4 : em.vz) * dt;
        em.mesh.rotation.x += em.spin * dt;
        em.mesh.rotation.y += em.spin * dt;
        if (em.mesh.position.y > 4.6 || em.mesh.position.z < -5.5) {
          const ang = Math.random() * Math.PI * 2;
          const rad = 0.8 + Math.random() * 4.2;
          em.mesh.position.set(Math.cos(ang) * rad, 0.1, Math.sin(ang) * rad);
        }
      });
    }

    // -----------------------------------------------------------------------
    // C. FORM 2 ANIMATION: 九霄雷劫 // XIANXIA THUNDER IMMORTAL DUCK
    // -----------------------------------------------------------------------
    else {
      const mode = state.anim.xianxia;
      const baseH = state.modules.xianxia.cloudBase ? XIANXIA_CLOUD_Y : XIANXIA_FEET_Y;

      let targetY = baseH;
      let pitchX = 0;
      let haloSpinSpeed = 0.55;
      let baguaSpinSpeed = -0.85;

      if (mode === 'idle') {
        // Serene levitation bobbing smoothly above storm cloud
        targetY = baseH + Math.sin(elapsed * 2.0) * 0.12;
        pitchX = Math.sin(elapsed * 1.2) * 0.03;
        haloSpinSpeed = 0.52;
        baguaSpinSpeed = -0.82;
        xBase.headGroup.rotation.y = THREE.MathUtils.lerp(xBase.headGroup.rotation.y, Math.sin(elapsed * 0.85) * 0.22, 0.06);
        xBase.headGroup.rotation.x = THREE.MathUtils.lerp(xBase.headGroup.rotation.x, 0, 0.08);
      } else if (mode === 'swords') {
        // Heroic forward sword-saint command stance
        targetY = baseH + 0.18 + Math.sin(elapsed * 3.4) * 0.08;
        pitchX = 0.15;
        haloSpinSpeed = 1.65;
        baguaSpinSpeed = -2.4;
        xBase.headGroup.rotation.y = THREE.MathUtils.lerp(xBase.headGroup.rotation.y, Math.sin(elapsed * 2.2) * 0.12, 0.1);
        xBase.headGroup.rotation.x = THREE.MathUtils.lerp(xBase.headGroup.rotation.x, -0.10, 0.1);
      } else if (mode === 'tribulation') {
        // Ascends higher in dramatic Heavenly Thunder Tribulation!
        targetY = baseH + 0.48 + Math.sin(elapsed * 5.2) * 0.06;
        pitchX = -0.14;
        haloSpinSpeed = 3.8;
        baguaSpinSpeed = -5.2;
        xBase.headGroup.rotation.y = THREE.MathUtils.lerp(xBase.headGroup.rotation.y, 0, 0.1);
        xBase.headGroup.rotation.x = THREE.MathUtils.lerp(xBase.headGroup.rotation.x, -0.16, 0.1);
      }

      xBase.rig.position.y = THREE.MathUtils.lerp(xBase.rig.position.y, targetY, 0.12);
      xBase.rig.rotation.x = THREE.MathUtils.lerp(xBase.rig.rotation.x, pitchX, 0.12);
      xBase.rig.rotation.z = THREE.MathUtils.lerp(xBase.rig.rotation.z, Math.sin(elapsed * 1.4) * 0.025, 0.1);
      xBase.rig.scale.set(scaleX, scaleY, scaleZ);
      xBase.lowerJawPivot.rotation.x = THREE.MathUtils.lerp(xBase.lowerJawPivot.rotation.x, quackJawAngle, 0.32);

      // Counter-rotating Thunder Drum Halo & Central Bagua Disc
      drumRingSpin.rotation.z += haloSpinSpeed * dt;
      baguaCenterSpin.rotation.z += baguaSpinSpeed * dt;

      // Halo inter-drum lightning arcs
      const haloArcRate = mode === 'tribulation' ? 0.055 : 0.14;
      xHaloBolts.forEach((hb) => {
        if (elapsed >= hb.nextT) {
          hb.nextT = elapsed + haloArcRate * (0.6 + Math.random() * 0.8);
          hb.grp.visible = mode === 'tribulation' ? true : Math.random() < 0.72;
          if (hb.grp.visible) {
            updateLightningBolt(hb, hb.a, hb.b, mode === 'tribulation' ? 0.18 : 0.10, mode === 'tribulation' ? 1.15 : 0.82);
          }
        }
      });

      // Subtle Celestial Ribbon sway & Talisman flutter
      const ribbonAmp = mode === 'swords' ? 0.14 : mode === 'tribulation' ? 0.22 : 0.06;
      ribbonGroup.rotation.x = Math.sin(elapsed * 3.2) * ribbonAmp;
      ribbonGroup.position.y = Math.sin(elapsed * 2.6) * 0.04;

      talismanPivot.rotation.z = -0.14 + Math.sin(elapsed * 5.2) * 0.14;
      talismanPivot.rotation.y = -0.35 + Math.cos(elapsed * 3.8) * 0.18;
      talismanPivot.position.y = 0.22 + Math.sin(elapsed * 3.1) * 0.05;

      // Floating golden lightning horns & pulsing forehead seal
      xFloatingHorns.forEach((h, i) => {
        h.mesh.position.y = h.baseY + Math.sin(elapsed * 3.2 + i * Math.PI) * 0.04;
      });
      const auraPulse = mode === 'tribulation' ? 3.4 + Math.sin(elapsed * 16) * 1.1 : mode === 'swords' ? 2.4 : 1.75;
      MAT.sealGlow.emissiveIntensity = auraPulse;
      MAT.swordBladeGlow.emissiveIntensity = mode === 'tribulation' ? 3.2 : mode === 'swords' ? 2.6 : 1.55;

      // Storm cloud gently lags slightly behind levitation bob
      xCloudBaseGroup.position.y = -0.78 - Math.sin(elapsed * 2.0 - 0.5) * 0.05;
      xCloudBaseGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.06;

      // 6 Flying Swords Formations & Staggered Thrusts
      xFlyingSwords.forEach((sw) => {
        if (mode === 'idle') {
          const hover = Math.sin(elapsed * 2.4 + sw.idx * 0.9) * 0.10;
          sw.pivot.position.lerp(new THREE.Vector3(sw.basePos.x, sw.basePos.y + hover, sw.basePos.z), 0.12);
          sw.body.rotation.x = THREE.MathUtils.lerp(sw.body.rotation.x, -0.12 + Math.sin(elapsed * 1.8 + sw.idx) * 0.06, 0.1);
          sw.body.rotation.y = THREE.MathUtils.lerp(sw.body.rotation.y, -sw.side * 0.16, 0.1);
          sw.body.rotation.z = THREE.MathUtils.lerp(sw.body.rotation.z, 0, 0.1);
          sw.trail.visible = false;
        } else if (mode === 'swords') {
          // Fan wide, spin along sword axis, and perform staggered darting forward thrusts!
          const cycle = (elapsed * 1.85 + sw.idx * 0.17) % 1.0;
          const thrust = cycle < 0.28 ? Math.sin((cycle / 0.28) * Math.PI) * 1.65 : 0;
          const fanX = sw.basePos.x * 1.28;
          const fanY = sw.basePos.y + (sw.tier - 1) * 0.18 + Math.sin(elapsed * 4.2 + sw.idx) * 0.08;
          const fanZ = sw.basePos.z + 0.35 + thrust;
          sw.pivot.position.lerp(new THREE.Vector3(fanX, fanY, fanZ), 0.25);
          sw.body.rotation.x = THREE.MathUtils.lerp(sw.body.rotation.x, 0.0, 0.2);
          sw.body.rotation.y = THREE.MathUtils.lerp(sw.body.rotation.y, -sw.side * 0.08, 0.2);
          sw.body.rotation.z += 12.0 * dt;
          sw.trail.visible = thrust > 0.25;
          if (sw.trail.visible) {
            sw.trail.scale.set(1.0, 0.7 + thrust * 0.5, 1.0);
          }
        } else if (mode === 'tribulation') {
          // Orbiting protective storm vortex ring pointing outward & upward
          const orbAng = elapsed * 2.6 + (sw.idx / 6) * Math.PI * 2;
          const orbRad = 2.05;
          const ox = Math.cos(orbAng) * orbRad;
          const oz = Math.sin(orbAng) * orbRad;
          const oy = 0.55 + Math.sin(elapsed * 4.5 + sw.idx) * 0.28;
          sw.pivot.position.lerp(new THREE.Vector3(ox, oy, oz), 0.16);
          sw.body.rotation.y = -orbAng + Math.PI / 2;
          sw.body.rotation.x = -0.35;
          sw.body.rotation.z += 8.0 * dt;
          sw.trail.visible = true;
          sw.trail.scale.set(0.85, 0.9, 0.85);
        }
      });

      // Sky Tribulation Vertical Lightning Bolts
      if (state.modules.xianxia.skyLightning) {
        const strikeRate = mode === 'tribulation' ? 0.09 : 0.42;
        const strikeChance = mode === 'tribulation' ? 0.78 : mode === 'swords' ? 0.22 : 0.10;
        let anyStruck = false;

        xSkyBolts.forEach((sb) => {
          if (elapsed >= sb.nextT) {
            sb.nextT = elapsed + strikeRate * (0.55 + Math.random() * 0.95);
            const active = Math.random() < strikeChance;
            sb.grp.visible = active;
            if (active) {
              const jx = (Math.random() - 0.5) * 0.8;
              const jz = (Math.random() - 0.5) * 0.8;
              updateLightningBolt(
                sb,
                new THREE.Vector3(sb.baseX + jx, 6.2, sb.baseZ + jz),
                new THREE.Vector3(sb.baseX + jx * 0.35, 0.05, sb.baseZ + jz * 0.35),
                0.34,
                mode === 'tribulation' ? 1.55 : 0.95
              );
              anyStruck = true;
            }
          }
        });

        if (anyStruck && mode === 'tribulation') {
          flashLight.color.setHex(0xd8b4fe);
          flashLight.intensity = 4.5;
        }
      }

      // Rotate ground Bagua altar ring & drift spirit sparks
      baguaFloorGroup.rotation.y += (mode === 'tribulation' ? 0.85 : 0.18) * dt;
      accentPointLight.intensity = mode === 'tribulation' ? 4.2 : 2.2;

      xianxiaSparks.forEach((sp) => {
        sp.ang += sp.orbitSpeed * dt * (mode === 'tribulation' ? 2.4 : 1.0);
        sp.mesh.position.y += sp.vy * dt * (mode === 'tribulation' ? 2.0 : 1.0);
        sp.mesh.position.x = Math.cos(sp.ang) * sp.rad;
        sp.mesh.position.z = Math.sin(sp.ang) * sp.rad;
        sp.mesh.rotation.y += 2.2 * dt;
        if (sp.mesh.position.y > 4.8) {
          sp.mesh.position.y = 0.08;
        }
      });
    }

    pace();
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    canvas: renderer.domElement,
    orbit: controls,
    start() {
      if (running) return;
      running = true;
      clock.getDelta();
      animate();
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
    setTier(tier) {
      state.anim[state.form] = ANIMS[state.form][tier];
    },
    quack: triggerQuack,
    reveal() {
      triggerMorphBurst();
      controls.spin(1.5);
    },
    resize(width, height, box) {
      renderer.setSize(width, height, false);
      fitStage(camera, controls, width, height, box);
    },
    dispose() {
      this.stop();
      controls.dispose();
      disposeStage(scene, renderer);
    },
  };
}
