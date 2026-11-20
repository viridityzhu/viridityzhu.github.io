// Evolved form MK-IV: the omnic mecha duck on robo-dog legs.
// The model, materials and animation come from its standalone showcase page;
// the page's own panels are replaced by the small API returned at the end.
import { createOrbit, createPacer, fitStage, disposeStage } from "./stage.js";

export function createMk4(THREE, ctx) {
  // =========================================================================
  // 1. UTILITY HELPERS: DETERMINISTIC PRNG, LOW-POLY ROUGHNESS & TEXTURES
  // =========================================================================

  /**
   * Simple seeded pseudo-random generator for reproducible rugged low-poly facets.
   */
  function createRng(seed = 1337) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * Perturbs vertices deterministically by spatial position hash so shared seams
   * remain 100% watertight while producing a chunky, rough-faceted low-poly silhouette.
   */
  function roughifyGeometry(geometry, amount = 0.03, seed = 42, scaleVec = null) {
    const pos = geometry.attributes.position;
    const rng = createRng(seed);
    const offsets = new Map();

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const key = `${Math.round(x * 500)}_${Math.round(y * 500)}_${Math.round(z * 500)}`;
      let off = offsets.get(key);
      if (!off) {
        off = [
          (rng() - 0.5) * 2 * amount,
          (rng() - 0.5) * 2 * amount,
          (rng() - 0.5) * 2 * amount,
        ];
        offsets.set(key, off);
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

    geometry.computeVertexNormals();
    return geometry;
  }

  /**
   * Generates a crisp matte hazard stripe CanvasTexture (yellow & dark charcoal).
   */
  function createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFD000';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#181c24';
    const stripeW = 36;
    for (let i = -256; i < 512; i += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + stripeW, 0);
      ctx.lineTo(i + stripeW - 256, 256);
      ctx.lineTo(i - 256, 256);
      ctx.closePath();
      ctx.fill();
    }

    // Subtle weathered scuffs so it never looks overly glossy or clean
    const rng = createRng(991);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(20,24,32,0.16)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(rng() * 256, rng() * 256, 4 + rng() * 14, 2 + rng() * 5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // =========================================================================
  // 2. MATERIAL PALETTE (STRICTLY FLAT-SHADED MATTE LOW-POLY FINISH)
  // =========================================================================

  const hazardTex = createHazardTexture();

  const MAT = {
    duckYellow: new THREE.MeshStandardMaterial({
      color: 0xFFD000,
      roughness: 0.76,
      metalness: 0.04,
      flatShading: true,
    }),
    duckYellowDark: new THREE.MeshStandardMaterial({
      color: 0xE5B200,
      roughness: 0.80,
      metalness: 0.06,
      flatShading: true,
    }),
    beakOrange: new THREE.MeshStandardMaterial({
      color: 0xFF5A1F,
      roughness: 0.72,
      metalness: 0.05,
      flatShading: true,
    }),
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.62,
      metalness: 0.78,
      flatShading: true,
    }),
    darkChassis: new THREE.MeshStandardMaterial({
      color: 0x151820,
      roughness: 0.74,
      metalness: 0.65,
      flatShading: true,
    }),
    titanium: new THREE.MeshStandardMaterial({
      color: 0x586270,
      roughness: 0.56,
      metalness: 0.74,
      flatShading: true,
    }),
    chromePiston: new THREE.MeshStandardMaterial({
      color: 0x9aa6b5,
      roughness: 0.36,
      metalness: 0.88,
      flatShading: true,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xB86B35,
      roughness: 0.54,
      metalness: 0.82,
      flatShading: true,
    }),
    cableDark: new THREE.MeshStandardMaterial({
      color: 0x1e232c,
      roughness: 0.86,
      metalness: 0.22,
      flatShading: true,
    }),
    hazard: new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.72,
      metalness: 0.25,
      flatShading: true,
    }),
    eyeWhite: new THREE.MeshStandardMaterial({
      color: 0xf4f6f9,
      roughness: 0.65,
      metalness: 0.02,
      flatShading: true,
    }),
    eyeBlack: new THREE.MeshStandardMaterial({
      color: 0x0b0d12,
      roughness: 0.5,
      metalness: 0.1,
      flatShading: true,
    }),
    cyanGlow: new THREE.MeshStandardMaterial({
      color: 0x00F0FF,
      emissive: 0x00F0FF,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.2,
      flatShading: true,
    }),
    crimsonGlow: new THREE.MeshStandardMaterial({
      color: 0xFF1E42,
      emissive: 0xFF1E42,
      emissiveIntensity: 2.5,
      roughness: 0.25,
      metalness: 0.2,
      flatShading: true,
    }),
    laserBeam: new THREE.MeshBasicMaterial({
      color: 0xFF1E42,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    laserCore: new THREE.MeshBasicMaterial({
      color: 0xFF7088,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    muzzleFlashOuter: new THREE.MeshBasicMaterial({
      color: 0xFF7700,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    muzzleFlashInner: new THREE.MeshBasicMaterial({
      color: 0xFFF3B0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    thunderBolt: new THREE.MeshBasicMaterial({
      color: 0x4DF7FF,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    sparkCyan: new THREE.MeshBasicMaterial({
      color: 0x00F0FF,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    }),
    sparkYellow: new THREE.MeshBasicMaterial({
      color: 0xFFD000,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    }),
  };

  const allDuckMaterials = [
    MAT.duckYellow, MAT.duckYellowDark, MAT.beakOrange,
    MAT.gunmetal, MAT.darkChassis, MAT.titanium,
    MAT.chromePiston, MAT.copper, MAT.cableDark,
    MAT.hazard, MAT.eyeWhite, MAT.eyeBlack,
    MAT.cyanGlow, MAT.crimsonGlow,
  ];

  /**
   * Helper to build shadow-casting meshes quickly.
   */
  function makeMesh(geo, mat, name = '') {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    if (name) m.name = name;
    return m;
  }

  // =========================================================================
  // 3. SCENE, RENDERER, CAMERA & DRAMATIC 3-POINT CYBERPUNK LIGHTING
  // =========================================================================

  const container = ctx.container;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d13);
  scene.fog = new THREE.FogExp2(0x0a0d13, 0.042);

  const camera = new THREE.PerspectiveCamera(42, ctx.width / ctx.height, 0.1, 100);
  const DEFAULT_CAM_POS = new THREE.Vector3(-4.2, 2.75, 5.25);
  const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1.55, 0.15);
  camera.position.copy(DEFAULT_CAM_POS);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  const pace = createPacer(renderer);
  renderer.setSize(ctx.width, ctx.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const controls = createOrbit(THREE, camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 2.6;
  controls.maxDistance = 13.5;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.copy(DEFAULT_CAM_TARGET);
  controls.update();

  // Lighting Setup
  const hemiLight = new THREE.HemisphereLight(0x6487ad, 0x111520, 0.85);
  scene.add(hemiLight);

  // Warm Key Light (front-top-left)
  const keyLight = new THREE.DirectionalLight(0xfff0d4, 2.55);
  keyLight.position.set(5.5, 8.5, 6.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 26;
  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // Electric Cyan Rim Light (back-right silhouette highlight)
  const rimLight = new THREE.DirectionalLight(0x00F0FF, 2.4);
  rimLight.position.set(-6.0, 4.5, -5.5);
  scene.add(rimLight);

  // Subtle Secondary Fill Light (front-right)
  const fillLight = new THREE.DirectionalLight(0x7aa2d4, 0.75);
  fillLight.position.set(-5.0, 2.5, 4.0);
  scene.add(fillLight);

  // Crimson Under-Accent Light
  const crimsonAccentLight = new THREE.PointLight(0xFF1E42, 2.2, 9.5, 1.6);
  crimsonAccentLight.position.set(-2.2, 0.65, 2.4);
  scene.add(crimsonAccentLight);

  // Dynamic Reactor Backlight
  const reactorPointLight = new THREE.PointLight(0x00F0FF, 1.9, 6.5, 1.7);
  scene.add(reactorPointLight);

  // Dynamic Muzzle Flash & Overdrive Strobe Light
  const muzzleLight = new THREE.PointLight(0xFF8811, 0, 8.0, 1.5);
  scene.add(muzzleLight);

  const strobeLight = new THREE.PointLight(0xFF1E42, 0, 12.0, 1.4);
  strobeLight.position.set(0, 4.5, 1.5);
  scene.add(strobeLight);

  // =========================================================================
  // 4. DARK CYBERPUNK STAGING FLOOR & LOW-POLY GRID
  // =========================================================================

  const stageGroup = new THREE.Group();
  scene.add(stageGroup);

  // Infinite-feeling matte dark floor catching crisp shadows
  const shadowFloor = new THREE.Mesh(
    new THREE.CircleGeometry(28, 32),
    new THREE.MeshStandardMaterial({
      color: 0x0c1018,
      roughness: 0.92,
      metalness: 0.15,
      flatShading: true,
    })
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.006;
  shadowFloor.receiveShadow = true;
  stageGroup.add(shadowFloor);

  // Scrolling neon-cyan & steel cyber grid lines
  const cyberGrid = new THREE.GridHelper(32, 32, 0x00F0FF, 0x1a2636);
  cyberGrid.position.y = 0.001;
  cyberGrid.material.transparent = true;
  cyberGrid.material.opacity = 0.36;
  stageGroup.add(cyberGrid);

  // Low-poly octagonal tactical pad ring beneath the duck
  const padRingGeo = new THREE.RingGeometry(2.15, 2.24, 8);
  const padRingMat = new THREE.MeshBasicMaterial({
    color: 0x00F0FF,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  });
  const padRing = new THREE.Mesh(padRingGeo, padRingMat);
  padRing.rotation.x = -Math.PI / 2;
  padRing.rotation.z = Math.PI / 8;
  padRing.position.y = 0.004;
  stageGroup.add(padRing);

  // Outer dashed corner ticks around tactical pad
  const outerTickGroup = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.02, 0.08),
      i % 2 === 0 ? MAT.hazard : MAT.titanium
    );
    tick.position.set(Math.cos(ang) * 2.55, 0.01, Math.sin(ang) * 2.55);
    tick.rotation.y = -ang + Math.PI / 2;
    outerTickGroup.add(tick);
  }
  stageGroup.add(outerTickGroup);

  // =========================================================================
  // 5. BUILD HIERARCHICAL LOW-POLY CYBERPUNK MECHA DUCK ("DUCK IN THE LOOSE")
  // =========================================================================

  const duckRoot = new THREE.Group();
  duckRoot.name = 'DuckInTheLoose_MKIV';
  scene.add(duckRoot);

  // Core rig that holds torso, head, armor, weapons, and classic feet
  const bodyRigGroup = new THREE.Group();
  bodyRigGroup.name = 'bodyRigGroup';
  duckRoot.add(bodyRigGroup);

  // Height constants so feet sit flush on y = 0 in both Robo-Dog and Classic modes
  const ROBO_BODY_Y = 1.48;
  const CLASSIC_BODY_Y = 0.72;
  bodyRigGroup.position.y = ROBO_BODY_Y;

  // -------------------------------------------------------------------------
  // 5.1 CORE LOW-POLY DUCK HULL & HEAD (`duckBodyGroup`)
  // -------------------------------------------------------------------------
  const duckBodyGroup = new THREE.Group();
  duckBodyGroup.name = 'duckBodyGroup';
  bodyRigGroup.add(duckBodyGroup);

  // Faceted Angular Duck Torso (sculpted low-poly icosahedron with chest keel & flat belly mount)
  const torsoGeo = new THREE.IcosahedronGeometry(0.95, 1);
  const tPos = torsoGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    let x = tPos.getX(i);
    let y = tPos.getY(i);
    let z = tPos.getZ(i);

    // Elongate front-to-back (+Z forward, -Z tail)
    z *= 1.38;
    x *= 0.94;
    y *= 0.84;

    // Puff chest keel forward and slightly upward
    if (z > 0.25) {
      y += 0.14 * (z / 1.3);
      x *= 0.92;
    }
    // Upturn rear silhouette into duck rump
    if (z < -0.35) {
      y += 0.28 * ((-z - 0.35) / 1.0);
      x *= 0.82;
    }
    // Flatten underside slightly for robo-dog mechanical chassis mounting
    if (y < -0.45) {
      y = -0.46 + (y + 0.45) * 0.25;
    }
    tPos.setXYZ(i, x, y, z);
  }
  roughifyGeometry(torsoGeo, 0.032, 101);
  const torsoMesh = makeMesh(torsoGeo, MAT.duckYellow, 'DuckTorso');
  torsoMesh.position.set(0, 0.18, 0.0);
  duckBodyGroup.add(torsoMesh);

  // Stubby Upturned Low-Poly Duck Tail (layered angular wedges)
  const tailMainGeo = roughifyGeometry(new THREE.ConeGeometry(0.42, 0.72, 5), 0.02, 102);
  const tailMain = makeMesh(tailMainGeo, MAT.duckYellow, 'DuckTailMain');
  tailMain.position.set(0, 0.56, -1.25);
  tailMain.rotation.x = -0.82;
  tailMain.scale.set(1.15, 1.0, 0.75);
  duckBodyGroup.add(tailMain);

  const tailTipGeo = roughifyGeometry(new THREE.ConeGeometry(0.24, 0.42, 4), 0.015, 103);
  const tailTip = makeMesh(tailTipGeo, MAT.duckYellowDark, 'DuckTailTip');
  tailTip.position.set(0, 0.80, -1.48);
  tailTip.rotation.x = -0.58;
  duckBodyGroup.add(tailTip);

  // Chunky Faceted Neck Collar
  const neckGeo = roughifyGeometry(new THREE.CylinderGeometry(0.42, 0.54, 0.56, 7), 0.02, 104);
  const neckMesh = makeMesh(neckGeo, MAT.duckYellow, 'DuckNeck');
  neckMesh.position.set(0, 0.76, 0.68);
  neckMesh.rotation.x = 0.16;
  duckBodyGroup.add(neckMesh);

  // Head Group (pivots cleanly at top of neck for scanning animation)
  const headGroup = new THREE.Group();
  headGroup.name = 'duckHeadGroup';
  headGroup.position.set(0, 1.18, 0.74);
  duckBodyGroup.add(headGroup);

  // Faceted Angular Duck Head
  const headGeo = new THREE.IcosahedronGeometry(0.64, 1);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);
    x *= 0.96;
    y *= 0.94;
    z *= 1.04;
    // Slightly angular brow & cheek planes
    if (y < -0.25) x *= 1.06;
    hPos.setXYZ(i, x, y, z);
  }
  roughifyGeometry(headGeo, 0.024, 201);
  const headMesh = makeMesh(headGeo, MAT.duckYellow, 'DuckHead');
  headGroup.add(headMesh);

  // Jagged Low-Poly "Thunderbolt" Mohawk Crest on top (雷霆小黄鸭 signature motif!)
  const boltShape = new THREE.Shape();
  boltShape.moveTo(0.0, 0.0);
  boltShape.lineTo(0.42, 0.14);
  boltShape.lineTo(0.18, 0.28);
  boltShape.lineTo(0.62, 0.50);
  boltShape.lineTo(0.24, 0.56);
  boltShape.lineTo(0.54, 0.86);
  boltShape.lineTo(-0.08, 0.62);
  boltShape.lineTo(0.10, 0.46);
  boltShape.lineTo(-0.28, 0.24);
  boltShape.lineTo(-0.04, 0.14);
  boltShape.closePath();

  const boltOuterGeo = new THREE.ExtrudeGeometry(boltShape, {
    depth: 0.12,
    bevelEnabled: false,
  });
  boltOuterGeo.center();
  roughifyGeometry(boltOuterGeo, 0.012, 205);

  const thunderCrestGroup = new THREE.Group();
  thunderCrestGroup.name = 'ThunderboltCrest';
  thunderCrestGroup.position.set(0, 0.78, -0.02);
  thunderCrestGroup.rotation.y = Math.PI / 2; // Align bolt silhouette along front-to-back mohawk plane
  thunderCrestGroup.rotation.z = -0.18;
  headGroup.add(thunderCrestGroup);

  const crestOuter = makeMesh(boltOuterGeo, MAT.duckYellow, 'CrestBoltYellow');
  thunderCrestGroup.add(crestOuter);

  // Inner glowing cyan lightning core seam
  const crestCoreGeo = boltOuterGeo.clone();
  const crestCore = makeMesh(crestCoreGeo, MAT.cyanGlow, 'CrestBoltCyanCore');
  crestCore.scale.set(0.76, 0.82, 1.24);
  thunderCrestGroup.add(crestCore);

  // Wide Faceted Orange Duck Bill (Upper + Lower jaw with slight fierce smirk)
  const billGroup = new THREE.Group();
  billGroup.name = 'DuckBillGroup';
  billGroup.position.set(0, -0.12, 0.58);
  headGroup.add(billGroup);

  const upperBillShape = new THREE.Shape();
  upperBillShape.moveTo(-0.34, 0);
  upperBillShape.lineTo(0.34, 0);
  upperBillShape.lineTo(0.42, 0.42);
  upperBillShape.lineTo(0.22, 0.62);
  upperBillShape.lineTo(-0.22, 0.62);
  upperBillShape.lineTo(-0.42, 0.42);
  upperBillShape.closePath();

  const upperBillGeo = new THREE.ExtrudeGeometry(upperBillShape, {
    depth: 0.14,
    bevelEnabled: false,
  });
  upperBillGeo.rotateX(Math.PI / 2);
  roughifyGeometry(upperBillGeo, 0.014, 210);
  const upperBill = makeMesh(upperBillGeo, MAT.beakOrange, 'UpperBill');
  upperBill.position.set(0, 0.10, -0.08);
  billGroup.add(upperBill);

  // Lower bill slightly opened for attitude
  const lowerBillGeo = roughifyGeometry(new THREE.BoxGeometry(0.56, 0.10, 0.50), 0.014, 211);
  const lowerBill = makeMesh(lowerBillGeo, MAT.beakOrange, 'LowerBill');
  lowerBill.position.set(0, -0.07, 0.16);
  lowerBill.rotation.x = 0.16;
  billGroup.add(lowerBill);

  // Classic Unhinged Low-Poly Left Eye (+X side) for comedic contrast
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.name = 'ClassicCartoonEyeLeft';
  leftEyeGroup.position.set(0.36, 0.15, 0.45);
  leftEyeGroup.rotation.y = 0.42;
  headGroup.add(leftEyeGroup);

  const eyeball = makeMesh(new THREE.IcosahedronGeometry(0.16, 1), MAT.eyeWhite, 'LeftEyeball');
  eyeball.scale.set(1.0, 1.08, 0.72);
  leftEyeGroup.add(eyeball);

  // Slightly off-center wide-eyed manic pupil
  const pupil = makeMesh(new THREE.IcosahedronGeometry(0.078, 1), MAT.eyeBlack, 'LeftPupil');
  pupil.position.set(0.02, 0.01, 0.085);
  pupil.scale.set(1, 1, 0.6);
  leftEyeGroup.add(pupil);

  // Tiny cartoon specular diamond
  const eyeSpec = makeMesh(new THREE.OctahedronGeometry(0.026, 0), MAT.eyeWhite, 'LeftEyeGlint');
  eyeSpec.position.set(-0.025, 0.045, 0.12);
  leftEyeGroup.add(eyeSpec);

  // Slightly cocked low-poly yellow angry/unhinged brow ridge
  const leftBrow = makeMesh(new THREE.BoxGeometry(0.24, 0.06, 0.10), MAT.duckYellowDark, 'LeftEyebrow');
  leftBrow.position.set(-0.01, 0.16, 0.06);
  leftBrow.rotation.z = 0.24;
  leftEyeGroup.add(leftBrow);

  // -------------------------------------------------------------------------
  // 5.2 OMNIC / CYBERNETIC IMPLANTS & ARMOR (`cyberArmorGroup` + head implants)
  // -------------------------------------------------------------------------
  const cyberArmorGroup = new THREE.Group();
  cyberArmorGroup.name = 'cyberArmorGroup';
  bodyRigGroup.add(cyberArmorGroup);

  // Head-mounted cyber implants (child of headGroup so they track head rotation,
  // toggled together with cyberArmorGroup!)
  const headCyberGroup = new THREE.Group();
  headCyberGroup.name = 'headCyberImplantsGroup';
  headGroup.add(headCyberGroup);

  // Right-Half Riveted Gunmetal Cyber-Jaw Plating (-X half of the orange bill)
  const cyberJawGroup = new THREE.Group();
  cyberJawGroup.name = 'CyberJawPlating';
  cyberJawGroup.position.set(-0.20, -0.10, 0.76);
  headCyberGroup.add(cyberJawGroup);

  const jawPlateTop = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.42, 0.17, 0.56), 0.01, 301),
    MAT.gunmetal,
    'CyberJawUpperPlate'
  );
  jawPlateTop.position.set(-0.02, 0.04, 0.04);
  jawPlateTop.rotation.y = -0.12;
  cyberJawGroup.add(jawPlateTop);

  const jawPlateLower = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.34, 0.13, 0.44), 0.008, 302),
    MAT.titanium,
    'CyberJawLowerPlate'
  );
  jawPlateLower.position.set(-0.03, -0.09, -0.02);
  jawPlateLower.rotation.x = 0.16;
  jawPlateLower.rotation.y = -0.12;
  cyberJawGroup.add(jawPlateLower);

  // Rivet studs on the cyber jaw
  for (let r = 0; r < 3; r++) {
    const rivet = makeMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 5), MAT.chromePiston);
    rivet.rotation.z = Math.PI / 2;
    rivet.position.set(-0.23, 0.05, -0.12 + r * 0.15);
    cyberJawGroup.add(rivet);
  }

  // Right-Eye Recessed Cyberpunk Optical Visor & Protruding Telescopic Crimson Laser Eye (-X)
  const cyberEyeGroup = new THREE.Group();
  cyberEyeGroup.name = 'CyberLaserEyeAssembly';
  cyberEyeGroup.position.set(-0.34, 0.15, 0.42);
  cyberEyeGroup.rotation.y = -0.30;
  headCyberGroup.add(cyberEyeGroup);

  // Angular armored eye-socket visor shroud
  const visorHousing = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.38, 0.30, 0.24), 0.012, 305),
    MAT.gunmetal,
    'VisorHousing'
  );
  cyberEyeGroup.add(visorHousing);

  // Heavy armored brow plate with hazard trim
  const browPlate = makeMesh(new THREE.BoxGeometry(0.44, 0.11, 0.30), MAT.titanium, 'CyberBrowPlate');
  browPlate.position.set(-0.02, 0.17, 0.04);
  browPlate.rotation.z = -0.22;
  cyberEyeGroup.add(browPlate);

  const browHazardStrip = makeMesh(new THREE.BoxGeometry(0.28, 0.045, 0.31), MAT.hazard);
  browHazardStrip.position.set(-0.04, 0.21, 0.04);
  browHazardStrip.rotation.z = -0.22;
  cyberEyeGroup.add(browHazardStrip);

  // Telescopic multi-ring optical barrel
  const barrelOuter = makeMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 6), MAT.darkChassis, 'OpticBarrelOuter');
  barrelOuter.rotation.x = Math.PI / 2;
  barrelOuter.position.z = 0.14;
  cyberEyeGroup.add(barrelOuter);

  const barrelInner = makeMesh(new THREE.CylinderGeometry(0.075, 0.095, 0.14, 6), MAT.copper, 'OpticBarrelInner');
  barrelInner.rotation.x = Math.PI / 2;
  barrelInner.position.z = 0.22;
  cyberEyeGroup.add(barrelInner);

  // Glowing Crimson Targeting Lens
  const crimsonLens = makeMesh(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 6), MAT.crimsonGlow, 'CrimsonLaserLens');
  crimsonLens.rotation.x = Math.PI / 2;
  crimsonLens.position.z = 0.28;
  cyberEyeGroup.add(crimsonLens);

  // Semi-transparent Volumetric Red Laser Sight Beam
  const laserBeamGroup = new THREE.Group();
  laserBeamGroup.name = 'VolumetricLaserBeam';
  laserBeamGroup.position.set(0, 0, 0.30);
  cyberEyeGroup.add(laserBeamGroup);

  const laserConeLen = 4.6;
  const laserOuterCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.22, laserConeLen, 6, 1, true),
    MAT.laserBeam
  );
  laserOuterCone.rotation.x = -Math.PI / 2;
  laserOuterCone.position.z = laserConeLen / 2;
  laserBeamGroup.add(laserOuterCone);

  const laserInnerCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.022, laserConeLen, 5, 1, true),
    MAT.laserCore
  );
  laserInnerCore.rotation.x = -Math.PI / 2;
  laserInnerCore.position.z = laserConeLen / 2;
  laserBeamGroup.add(laserInnerCore);

  // Side-Mounted Omnic Tactical Antenna Fin & Comm Sensor Pod (Right temple -X)
  const commPodGroup = new THREE.Group();
  commPodGroup.name = 'OmnicSensorPod';
  commPodGroup.position.set(-0.60, 0.08, 0.02);
  headCyberGroup.add(commPodGroup);

  const podCore = makeMesh(new THREE.CylinderGeometry(0.16, 0.18, 0.14, 6), MAT.gunmetal, 'CommPodBase');
  podCore.rotation.z = Math.PI / 2;
  commPodGroup.add(podCore);

  const podCap = makeMesh(new THREE.CylinderGeometry(0.09, 0.12, 0.18, 6), MAT.titanium);
  podCap.rotation.z = Math.PI / 2;
  podCap.position.x = -0.04;
  commPodGroup.add(podCap);

  // Cyan status LED on temple pod
  const podLed = makeMesh(new THREE.BoxGeometry(0.05, 0.05, 0.09), MAT.cyanGlow);
  podLed.position.set(-0.11, 0.02, 0.08);
  commPodGroup.add(podLed);

  // Swept angular antenna fin + tall comms whip
  const antFin = makeMesh(new THREE.BoxGeometry(0.05, 0.52, 0.16), MAT.gunmetal, 'AntennaFin');
  antFin.position.set(-0.08, 0.28, -0.10);
  antFin.rotation.x = -0.32;
  commPodGroup.add(antFin);

  const antWhip = makeMesh(new THREE.CylinderGeometry(0.012, 0.025, 0.72, 5), MAT.chromePiston, 'AntennaWhip');
  antWhip.position.set(-0.09, 0.48, -0.16);
  antWhip.rotation.x = -0.26;
  commPodGroup.add(antWhip);

  const antTip = makeMesh(new THREE.OctahedronGeometry(0.036, 0), MAT.crimsonGlow);
  antTip.position.set(-0.09, 0.84, -0.25);
  commPodGroup.add(antTip);

  // --- Torso Cyber Armor (Inside `cyberArmorGroup`) ---

  // Chest Tactical Breastplate with hazard bar & vents
  const chestArmorGroup = new THREE.Group();
  chestArmorGroup.name = 'ChestTacticalArmor';
  chestArmorGroup.position.set(0, 0.15, 1.02);
  cyberArmorGroup.add(chestArmorGroup);

  const chestMainPlate = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.92, 0.62, 0.34), 0.018, 310),
    MAT.gunmetal,
    'ChestMainPlate'
  );
  chestMainPlate.rotation.x = 0.22;
  chestArmorGroup.add(chestMainPlate);

  const chestUpperTrim = makeMesh(new THREE.BoxGeometry(0.74, 0.14, 0.38), MAT.hazard, 'ChestHazardStrip');
  chestUpperTrim.position.set(0, 0.22, 0.05);
  chestUpperTrim.rotation.x = 0.22;
  chestArmorGroup.add(chestUpperTrim);

  // Twin recessed cyan radiator slits on chest
  [-0.22, 0.22].forEach((sx) => {
    const vent = makeMesh(new THREE.BoxGeometry(0.18, 0.09, 0.06), MAT.cyanGlow);
    vent.position.set(sx, -0.05, 0.18);
    vent.rotation.x = 0.22;
    chestArmorGroup.add(vent);
  });

  // Riveted Shoulder Armor Pauldrons (Left +X & Right -X)
  [-1, 1].forEach((side) => {
    const pauldron = new THREE.Group();
    pauldron.name = side < 0 ? 'RightShoulderPauldron' : 'LeftShoulderPauldron';
    pauldron.position.set(side * 0.96, 0.42, 0.26);
    pauldron.rotation.z = -side * 0.28;
    cyberArmorGroup.add(pauldron);

    const shell = makeMesh(
      roughifyGeometry(new THREE.BoxGeometry(0.36, 0.56, 0.78), 0.015, 315 + side),
      MAT.gunmetal
    );
    pauldron.add(shell);

    const trim = makeMesh(new THREE.BoxGeometry(0.40, 0.14, 0.64), MAT.titanium);
    trim.position.set(side * 0.04, 0.18, 0);
    pauldron.add(trim);

    const hazardTab = makeMesh(new THREE.BoxGeometry(0.42, 0.10, 0.26), MAT.hazard);
    hazardTab.position.set(side * 0.03, -0.16, 0.18);
    pauldron.add(hazardTab);

    // 3 Titanium bolts
    for (let b = -1; b <= 1; b++) {
      const bolt = makeMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 5), MAT.chromePiston);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(side * 0.20, 0.02, b * 0.22);
      pauldron.add(bolt);
    }
  });

  // Exposed Segmented Metal Dorsal Spine Plates along the back
  const spineGroup = new THREE.Group();
  spineGroup.name = 'DorsalSpinePlates';
  cyberArmorGroup.add(spineGroup);

  const spineCoords = [
    { y: 0.90, z: 0.32, rx: -0.35, s: 0.82 },
    { y: 0.86, z: 0.02, rx: -0.15, s: 0.96 },
    { y: 0.84, z: -0.34, rx: 0.08, s: 1.02 },
    { y: 0.78, z: -0.72, rx: 0.30, s: 0.88 },
    { y: 0.68, z: -1.04, rx: 0.55, s: 0.68 },
  ];
  spineCoords.forEach((sc, idx) => {
    const seg = makeMesh(
      roughifyGeometry(new THREE.BoxGeometry(0.48 * sc.s, 0.16, 0.36 * sc.s), 0.01, 330 + idx),
      idx % 2 === 0 ? MAT.gunmetal : MAT.titanium,
      `SpinePlate_${idx}`
    );
    seg.position.set(0, sc.y, sc.z);
    seg.rotation.x = sc.rx;
    spineGroup.add(seg);

    // Dorsal ridge fin
    const fin = makeMesh(new THREE.BoxGeometry(0.10, 0.18, 0.24 * sc.s), MAT.darkChassis);
    fin.position.set(0, sc.y + 0.10, sc.z);
    fin.rotation.x = sc.rx;
    spineGroup.add(fin);
  });

  // Glowing Cyan Thunder Arc Reactor Core on the back + Rotating Energy Rings
  const reactorGroup = new THREE.Group();
  reactorGroup.name = 'ThunderArcReactor';
  reactorGroup.position.set(0, 0.98, -0.24);
  reactorGroup.rotation.x = -0.22;
  cyberArmorGroup.add(reactorGroup);

  const reactorHousing = makeMesh(new THREE.CylinderGeometry(0.42, 0.48, 0.26, 6), MAT.gunmetal, 'ReactorHousing');
  reactorGroup.add(reactorHousing);

  // 4 Copper clamp brackets around reactor
  for (let c = 0; c < 4; c++) {
    const ang = (c / 4) * Math.PI * 2 + Math.PI / 4;
    const clamp = makeMesh(new THREE.BoxGeometry(0.12, 0.28, 0.14), MAT.copper);
    clamp.position.set(Math.cos(ang) * 0.42, 0.04, Math.sin(ang) * 0.42);
    clamp.rotation.y = -ang;
    reactorGroup.add(clamp);
  }

  // Glowing Cyan Energy Core
  const reactorCore = makeMesh(new THREE.OctahedronGeometry(0.24, 0), MAT.cyanGlow, 'ReactorEnergyCore');
  reactorCore.position.y = 0.14;
  reactorGroup.add(reactorCore);

  // Counter-rotating Low-Poly Containment Rings
  const reactorRingOuter = makeMesh(new THREE.TorusGeometry(0.36, 0.036, 4, 8), MAT.cyanGlow, 'ReactorRingOuter');
  reactorRingOuter.rotation.x = Math.PI / 2;
  reactorRingOuter.position.y = 0.18;
  reactorGroup.add(reactorRingOuter);

  const reactorRingInner = makeMesh(new THREE.TorusGeometry(0.26, 0.028, 4, 6), MAT.titanium, 'ReactorRingInner');
  reactorRingInner.rotation.x = Math.PI / 2;
  reactorRingInner.position.y = 0.24;
  reactorGroup.add(reactorRingInner);

  // Dual Angled Heat-Sink Exhaust Thrusters on Rear Flanks
  const thrusterGlowMeshes = [];
  [-1, 1].forEach((side) => {
    const thruster = new THREE.Group();
    thruster.name = side < 0 ? 'RightExhaustThruster' : 'LeftExhaustThruster';
    thruster.position.set(side * 0.68, 0.66, -0.78);
    thruster.rotation.set(0.38, -side * 0.32, -side * 0.22);
    cyberArmorGroup.add(thruster);

    const nozzle = makeMesh(new THREE.CylinderGeometry(0.18, 0.26, 0.56, 6), MAT.gunmetal);
    nozzle.rotation.x = Math.PI / 2;
    thruster.add(nozzle);

    // Layered heat-sink radiator fins
    for (let f = 0; f < 3; f++) {
      const fin = makeMesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 6), MAT.titanium);
      fin.rotation.x = Math.PI / 2;
      fin.position.z = -0.10 + f * 0.12;
      thruster.add(fin);
    }

    const glowCone = makeMesh(new THREE.ConeGeometry(0.17, 0.34, 6), MAT.cyanGlow);
    glowCone.rotation.x = -Math.PI / 2;
    glowCone.position.z = -0.34;
    thruster.add(glowCone);
    thrusterGlowMeshes.push(glowCone);
  });

  // Dark & Copper Segmented Cable Conduits connecting neck, shoulders & reactor
  const cablePaths = [
    {
      pts: [
        new THREE.Vector3(-0.32, 0.98, 0.42),
        new THREE.Vector3(-0.56, 0.92, 0.14),
        new THREE.Vector3(-0.34, 0.96, -0.18),
      ],
      mat: MAT.cableDark,
      r: 0.042,
    },
    {
      pts: [
        new THREE.Vector3(0.30, 0.96, 0.44),
        new THREE.Vector3(0.54, 0.88, 0.16),
        new THREE.Vector3(0.32, 0.96, -0.18),
      ],
      mat: MAT.copper,
      r: 0.036,
    },
    {
      pts: [
        new THREE.Vector3(-0.42, 0.86, -0.36),
        new THREE.Vector3(-0.88, 0.54, -0.20),
        new THREE.Vector3(-0.78, 0.14, 0.16),
      ],
      mat: MAT.cableDark,
      r: 0.04,
    },
    {
      pts: [
        new THREE.Vector3(0.42, 0.86, -0.36),
        new THREE.Vector3(0.88, 0.54, -0.20),
        new THREE.Vector3(0.78, 0.14, 0.16),
      ],
      mat: MAT.cableDark,
      r: 0.04,
    },
  ];
  cablePaths.forEach((cp, idx) => {
    const curve = new THREE.CatmullRomCurve3(cp.pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 7, cp.r, 5, false);
    const tube = makeMesh(tubeGeo, cp.mat, `CableConduit_${idx}`);
    cyberArmorGroup.add(tube);
  });

  // -------------------------------------------------------------------------
  // 5.3 HEAVY WEAPONRY MODULES & MECHANICAL WING-SHIELDS (`weaponsGroup`)
  // -------------------------------------------------------------------------
  const weaponsGroup = new THREE.Group();
  weaponsGroup.name = 'weaponsGroup';
  bodyRigGroup.add(weaponsGroup);

  // Angular Low-Poly Mechanical Wing-Shield Fins flanking upper mounts
  [-1, 1].forEach((side) => {
    const wingGroup = new THREE.Group();
    wingGroup.name = side < 0 ? 'RightCyberWingShield' : 'LeftCyberWingShield';
    wingGroup.position.set(side * 0.92, 0.56, -0.28);
    wingGroup.rotation.set(0.20, -side * 0.34, -side * 0.48);
    weaponsGroup.add(wingGroup);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.88, 0.24);
    wingShape.lineTo(1.12, -0.12);
    wingShape.lineTo(0.68, -0.38);
    wingShape.lineTo(0.08, -0.26);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.09, bevelEnabled: false });
    wingGeo.center();
    const mainFeather = makeMesh(wingGeo, MAT.gunmetal);
    mainFeather.scale.x = side;
    mainFeather.position.x = side * 0.44;
    wingGroup.add(mainFeather);

    // Yellow accent strip on wing edge so silhouette reads unmistakably as cyber-duck
    const yellowEdge = makeMesh(new THREE.BoxGeometry(0.62, 0.11, 0.12), MAT.duckYellow);
    yellowEdge.position.set(side * 0.48, 0.16, 0);
    yellowEdge.rotation.z = side * 0.18;
    wingGroup.add(yellowEdge);

    const lowerBlade = makeMesh(new THREE.BoxGeometry(0.66, 0.14, 0.07), MAT.titanium);
    lowerBlade.position.set(side * 0.36, -0.22, -0.03);
    lowerBlade.rotation.z = -side * 0.12;
    wingGroup.add(lowerBlade);
  });

  // --- RIGHT FLANK (-X): 6-Barrel Rotary Minigun / Gatling Cannon ---
  const minigunMount = new THREE.Group();
  minigunMount.name = 'RightMinigunMount';
  minigunMount.position.set(-1.12, 0.24, 0.22);
  weaponsGroup.add(minigunMount);

  // Articulated weapon arm pylon
  const rightArmStrut = makeMesh(new THREE.BoxGeometry(0.42, 0.18, 0.24), MAT.darkChassis);
  rightArmStrut.position.set(0.12, 0.12, -0.05);
  rightArmStrut.rotation.z = -0.32;
  minigunMount.add(rightArmStrut);

  const rightJointDrum = makeMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 6), MAT.hazard);
  rightJointDrum.rotation.z = Math.PI / 2;
  rightJointDrum.position.set(-0.08, 0.05, -0.05);
  minigunMount.add(rightJointDrum);

  // Recoil Sub-group (slides back along -Z when firing!)
  const minigunRecoilGroup = new THREE.Group();
  minigunRecoilGroup.name = 'MinigunRecoilGroup';
  minigunRecoilGroup.position.set(-0.24, 0.0, 0.12);
  minigunMount.add(minigunRecoilGroup);

  // Heavy Receiver Block
  const mgReceiver = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.36, 0.34, 0.68), 0.01, 401),
    MAT.gunmetal,
    'MinigunReceiver'
  );
  minigunRecoilGroup.add(mgReceiver);

  // Top carry handle & optics rail
  const mgTopRail = makeMesh(new THREE.BoxGeometry(0.14, 0.10, 0.56), MAT.titanium);
  mgTopRail.position.set(0, 0.21, 0.02);
  minigunRecoilGroup.add(mgTopRail);

  // Ammo Drum hanging below receiver + hazard band
  const ammoDrum = makeMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 8), MAT.darkChassis, 'MinigunAmmoDrum');
  ammoDrum.rotation.z = Math.PI / 2;
  ammoDrum.position.set(0, -0.30, -0.08);
  minigunRecoilGroup.add(ammoDrum);

  const ammoBand = makeMesh(new THREE.CylinderGeometry(0.23, 0.23, 0.11, 8), MAT.hazard);
  ammoBand.rotation.z = Math.PI / 2;
  ammoBand.position.set(0, -0.30, -0.08);
  minigunRecoilGroup.add(ammoBand);

  // Copper ammo feed chute
  const feedChute = makeMesh(new THREE.BoxGeometry(0.14, 0.20, 0.22), MAT.copper);
  feedChute.position.set(0.10, -0.14, -0.08);
  minigunRecoilGroup.add(feedChute);

  // Cooling Shroud around rear barrels
  const mgShroud = makeMesh(new THREE.CylinderGeometry(0.19, 0.20, 0.36, 6), MAT.titanium);
  mgShroud.rotation.x = Math.PI / 2;
  mgShroud.position.z = 0.44;
  minigunRecoilGroup.add(mgShroud);

  // 6-Barrel Spinning Cluster (`minigunBarrelCluster`)
  const minigunBarrelCluster = new THREE.Group();
  minigunBarrelCluster.name = 'MinigunSpinBarrels';
  minigunBarrelCluster.position.z = 0.34;
  minigunRecoilGroup.add(minigunBarrelCluster);

  const barrelRadiusRing = 0.095;
  for (let b = 0; b < 6; b++) {
    const ang = (b / 6) * Math.PI * 2;
    const barrel = makeMesh(
      new THREE.CylinderGeometry(0.028, 0.030, 1.18, 5),
      MAT.gunmetal,
      `MinigunBarrel_${b}`
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(Math.cos(ang) * barrelRadiusRing, Math.sin(ang) * barrelRadiusRing, 0.56);
    minigunBarrelCluster.add(barrel);
  }

  // Central drive shaft & 2 barrel clamp rings
  const mgAxle = makeMesh(new THREE.CylinderGeometry(0.036, 0.036, 1.12, 6), MAT.chromePiston);
  mgAxle.rotation.x = Math.PI / 2;
  mgAxle.position.z = 0.54;
  minigunBarrelCluster.add(mgAxle);

  [0.64, 1.02].forEach((zPos) => {
    const clamp = makeMesh(new THREE.CylinderGeometry(0.145, 0.145, 0.07, 6), MAT.titanium);
    clamp.rotation.x = Math.PI / 2;
    clamp.position.z = zPos;
    minigunBarrelCluster.add(clamp);
  });

  // Spiky Low-Poly Emissive Muzzle Flash (visible & flickering during OVERDRIVE)
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.name = 'MinigunMuzzleFlash';
  muzzleFlashGroup.position.set(0, 0, 1.56);
  muzzleFlashGroup.visible = false;
  minigunRecoilGroup.add(muzzleFlashGroup);

  const flashSpikes = [
    { r: 0.18, h: 0.85, rx: Math.PI / 2, rz: 0, z: 0.36, mat: MAT.muzzleFlashOuter },
    { r: 0.10, h: 0.62, rx: Math.PI / 2, rz: 0, z: 0.24, mat: MAT.muzzleFlashInner },
  ];
  flashSpikes.forEach((sp) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(sp.r, sp.h, 4), sp.mat);
    cone.rotation.x = sp.rx;
    cone.position.z = sp.z;
    muzzleFlashGroup.add(cone);
  });
  for (let s = 0; s < 5; s++) {
    const ang = (s / 5) * Math.PI * 2;
    const radialSpike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.44, 4), MAT.muzzleFlashOuter);
    radialSpike.position.set(Math.cos(ang) * 0.16, Math.sin(ang) * 0.16, 0.06);
    radialSpike.rotation.z = ang - Math.PI / 2;
    radialSpike.rotation.x = 0.28;
    muzzleFlashGroup.add(radialSpike);
  }

  // --- LEFT FLANK (+X): Cyberpunk Thunder Railgun & Micro-Missile Pod ---
  const railgunMount = new THREE.Group();
  railgunMount.name = 'LeftRailgunMount';
  railgunMount.position.set(1.12, 0.24, 0.20);
  weaponsGroup.add(railgunMount);

  const leftArmStrut = makeMesh(new THREE.BoxGeometry(0.42, 0.18, 0.24), MAT.darkChassis);
  leftArmStrut.position.set(-0.12, 0.12, -0.05);
  leftArmStrut.rotation.z = 0.32;
  railgunMount.add(leftArmStrut);

  const leftJointDrum = makeMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 6), MAT.hazard);
  leftJointDrum.rotation.z = Math.PI / 2;
  leftJointDrum.position.set(0.08, 0.05, -0.05);
  railgunMount.add(leftJointDrum);

  const railgunRecoilGroup = new THREE.Group();
  railgunRecoilGroup.name = 'RailgunRecoilGroup';
  railgunRecoilGroup.position.set(0.24, 0.02, 0.12);
  railgunMount.add(railgunRecoilGroup);

  // Heavy Gunmetal Breech Housing
  const rgBreech = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.32, 0.34, 0.72), 0.01, 410),
    MAT.gunmetal,
    'RailgunBreech'
  );
  railgunRecoilGroup.add(rgBreech);

  // Parallel Twin Electromagnetic Accelerator Rails (Upper & Lower)
  const upperRail = makeMesh(new THREE.BoxGeometry(0.14, 0.08, 1.18), MAT.titanium, 'RailgunUpperRail');
  upperRail.position.set(0, 0.11, 0.74);
  railgunRecoilGroup.add(upperRail);

  const lowerRail = makeMesh(new THREE.BoxGeometry(0.14, 0.08, 1.18), MAT.titanium, 'RailgunLowerRail');
  lowerRail.position.set(0, -0.11, 0.74);
  railgunRecoilGroup.add(lowerRail);

  // Side structural guide rails
  [-0.10, 0.10].forEach((sx) => {
    const sideBar = makeMesh(new THREE.BoxGeometry(0.04, 0.26, 0.92), MAT.gunmetal);
    sideBar.position.set(sx, 0, 0.56);
    railgunRecoilGroup.add(sideBar);
  });

  // 4 Glowing Cyan Capacitor Coils lining the electromagnetic gap
  const railgunCoilMeshes = [];
  for (let c = 0; c < 4; c++) {
    const coil = makeMesh(new THREE.BoxGeometry(0.18, 0.14, 0.11), MAT.cyanGlow, `RailgunCoil_${c}`);
    coil.position.set(0, 0, 0.36 + c * 0.24);
    railgunRecoilGroup.add(coil);
    railgunCoilMeshes.push(coil);
  }

  // Top-Mounted 4-Tube Micro-Missile Pod
  const missilePod = new THREE.Group();
  missilePod.name = 'MicroMissilePod';
  missilePod.position.set(0.02, 0.32, -0.06);
  railgunRecoilGroup.add(missilePod);

  const podBox = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.34, 0.28, 0.46), 0.008, 415),
    MAT.darkChassis
  );
  missilePod.add(podBox);

  const podHazardCap = makeMesh(new THREE.BoxGeometry(0.36, 0.06, 0.26), MAT.hazard);
  podHazardCap.position.set(0, 0.15, 0);
  missilePod.add(podHazardCap);

  // 4 Stubby Crimson-Tipped Micro-Missile Warheads peeking out the front
  const missileOffsets = [
    [-0.08, 0.06],
    [0.08, 0.06],
    [-0.08, -0.06],
    [0.08, -0.06],
  ];
  missileOffsets.forEach(([mx, my], idx) => {
    const tube = makeMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 6), MAT.titanium);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(mx, my, 0.22);
    missilePod.add(tube);

    const warhead = makeMesh(new THREE.ConeGeometry(0.048, 0.12, 5), MAT.crimsonGlow, `MissileTip_${idx}`);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(mx, my, 0.29);
    missilePod.add(warhead);
  });

  // -------------------------------------------------------------------------
  // 5.4 ALTERNATE CLASSIC LOW-POLY WEBBED DUCK FEET (`classicFeetGroup`)
  // -------------------------------------------------------------------------
  const classicFeetGroup = new THREE.Group();
  classicFeetGroup.name = 'classicFeetGroup';
  classicFeetGroup.visible = false; // Shown when Robo-Dog Chassis is toggled OFF
  bodyRigGroup.add(classicFeetGroup);

  [-1, 1].forEach((side) => {
    const footRoot = new THREE.Group();
    footRoot.position.set(side * 0.44, -0.34, 0.08);
    classicFeetGroup.add(footRoot);

    // Chunky ankle leg
    const ankle = makeMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.36, 6), MAT.beakOrange);
    ankle.position.y = -0.14;
    footRoot.add(ankle);

    // Webbed low-poly duck foot base
    const webShape = new THREE.Shape();
    webShape.moveTo(-0.16, -0.18);
    webShape.lineTo(0.16, -0.18);
    webShape.lineTo(0.32, 0.36);
    webShape.lineTo(0.10, 0.28);
    webShape.lineTo(0.0, 0.42);
    webShape.lineTo(-0.10, 0.28);
    webShape.lineTo(-0.32, 0.36);
    webShape.closePath();

    const webGeo = new THREE.ExtrudeGeometry(webShape, { depth: 0.10, bevelEnabled: false });
    webGeo.rotateX(Math.PI / 2);
    roughifyGeometry(webGeo, 0.012, 500 + side);
    const webFoot = makeMesh(webGeo, MAT.beakOrange, side < 0 ? 'ClassicFootRight' : 'ClassicFootLeft');
    webFoot.position.set(0, -0.28, 0.06);
    webFoot.rotation.y = side * 0.16;
    footRoot.add(webFoot);
  });

  // -------------------------------------------------------------------------
  // 5.5 CYBERPUNK ROBO-DOG ARTICULATED 4-LEG CHASSIS (`roboDogLegsGroup`)
  // -------------------------------------------------------------------------
  const roboDogLegsGroup = new THREE.Group();
  roboDogLegsGroup.name = 'roboDogLegsGroup';
  bodyRigGroup.add(roboDogLegsGroup);

  // Under-belly heavy cyberpunk robo-dog mechanical saddle chassis
  const houndChassis = makeMesh(
    roughifyGeometry(new THREE.BoxGeometry(0.96, 0.26, 1.78), 0.015, 600),
    MAT.darkChassis,
    'RoboDogSpineFrame'
  );
  houndChassis.position.set(0, -0.34, -0.02);
  roboDogLegsGroup.add(houndChassis);

  // Front & rear armored bumper skirts with hazard markings
  const frontBumper = makeMesh(new THREE.BoxGeometry(0.84, 0.16, 0.22), MAT.hazard);
  frontBumper.position.set(0, -0.34, 0.90);
  frontBumper.rotation.x = 0.28;
  roboDogLegsGroup.add(frontBumper);

  const rearBumper = makeMesh(new THREE.BoxGeometry(0.76, 0.16, 0.20), MAT.titanium);
  rearBumper.position.set(0, -0.34, -0.92);
  rearBumper.rotation.x = -0.24;
  roboDogLegsGroup.add(rearBumper);

  // Front & rear axle bridge beams
  [0.64, -0.68].forEach((zAxle) => {
    const axle = makeMesh(new THREE.CylinderGeometry(0.12, 0.12, 1.38, 6), MAT.gunmetal);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, -0.36, zAxle);
    roboDogLegsGroup.add(axle);

    const copperManifold = makeMesh(new THREE.CylinderGeometry(0.055, 0.055, 1.02, 5), MAT.copper);
    copperManifold.rotation.z = Math.PI / 2;
    copperManifold.position.set(0, -0.46, zAxle + (zAxle > 0 ? -0.10 : 0.10));
    roboDogLegsGroup.add(copperManifold);
  });

  /**
   * Builds a single Boston Dynamics Spot / cyberpunk hound articulated leg.
   * Exact segment lengths:
   *   L_THIGH = 0.64, L_SHIN = 0.68, PAW_SOLE_OFFSET = 0.07
   * At resting hip height y_world = ROBO_BODY_Y - 0.36 = 1.12:
   *   With thighRot = -0.44 rad (angled forward/down) and shinLocalRot = +0.94 rad (reverse-jointed):
   *   Vertical drop = 0.64*cos(-0.44) + 0.68*cos(0.50) + 0.07 = 0.579 + 0.597 + 0.07 = 1.246
   * We dynamically align the resting chassis height using exact leg kinematics below!
   */
  const LEG_THIGH_LEN = 0.62;
  const LEG_SHIN_LEN = 0.64;
  const LEG_PAW_HEIGHT = 0.08;
  const HIP_LOCAL_Y = -0.36;

  const roboLegs = [];
  const legSpecs = [
    { id: 'FL', side: 1, z: 0.64, phase: 0.0, isFront: true },
    { id: 'FR', side: -1, z: 0.64, phase: Math.PI, isFront: true },
    { id: 'RL', side: 1, z: -0.68, phase: Math.PI, isFront: false },
    { id: 'RR', side: -1, z: -0.68, phase: 0.0, isFront: false },
  ];

  legSpecs.forEach((spec) => {
    const hipMount = new THREE.Group();
    hipMount.name = `RoboLeg_${spec.id}`;
    hipMount.position.set(spec.side * 0.72, HIP_LOCAL_Y, spec.z);
    roboDogLegsGroup.add(hipMount);

    // Shoulder Servo Drum Housing
    const servoDrum = makeMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 7), MAT.gunmetal);
    servoDrum.rotation.z = Math.PI / 2;
    hipMount.add(servoDrum);

    const servoCap = makeMesh(new THREE.CylinderGeometry(0.10, 0.12, 0.28, 6), MAT.hazard);
    servoCap.rotation.z = Math.PI / 2;
    hipMount.add(servoCap);

    // Abduction Pivot (allows stance widening in OVERDRIVE)
    const abductPivot = new THREE.Group();
    abductPivot.position.set(spec.side * 0.14, 0, 0);
    hipMount.add(abductPivot);

    // Upper Thigh Group (rotates around X for forward/back swing)
    const thighPivot = new THREE.Group();
    abductPivot.add(thighPivot);

    // Angled Armor Thigh Strut
    const thighMain = makeMesh(
      roughifyGeometry(new THREE.BoxGeometry(0.18, LEG_THIGH_LEN, 0.22), 0.008, 610 + spec.z * 10),
      MAT.titanium
    );
    thighMain.position.set(0, -LEG_THIGH_LEN * 0.5, 0);
    thighPivot.add(thighMain);

    // Outer Armored Plate Guard on Thigh
    const thighGuard = makeMesh(new THREE.BoxGeometry(0.08, LEG_THIGH_LEN * 0.76, 0.26), MAT.gunmetal);
    thighGuard.position.set(spec.side * 0.09, -LEG_THIGH_LEN * 0.44, 0.02);
    thighPivot.add(thighGuard);

    // Hydraulic Piston Rod mounted along thigh flank
    const pistonOuter = makeMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.30, 5), MAT.darkChassis);
    pistonOuter.position.set(spec.side * 0.04, -0.22, -0.14);
    thighPivot.add(pistonOuter);

    const pistonInner = makeMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.34, 5), MAT.chromePiston);
    pistonInner.position.set(spec.side * 0.04, -0.44, -0.14);
    thighPivot.add(pistonInner);

    // Hazard-Yellow Knee Joint Drum at bottom of thigh
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -LEG_THIGH_LEN, 0);
    thighPivot.add(kneePivot);

    const kneeDrum = makeMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 6), MAT.hazard);
    kneeDrum.rotation.z = Math.PI / 2;
    kneePivot.add(kneeDrum);

    const kneeCap = makeMesh(new THREE.BoxGeometry(0.16, 0.16, 0.14), MAT.gunmetal);
    kneeCap.position.set(0, 0.02, spec.isFront ? -0.10 : 0.10);
    kneePivot.add(kneeCap);

    // Reverse-Jointed / Digitigrade Lower Shin Strut
    const shinStrut = makeMesh(new THREE.BoxGeometry(0.12, LEG_SHIN_LEN, 0.14), MAT.gunmetal);
    shinStrut.position.set(0, -LEG_SHIN_LEN * 0.5, 0);
    kneePivot.add(shinStrut);

    // Copper actuator tendon rod parallel to shin
    const shinRod = makeMesh(new THREE.CylinderGeometry(0.024, 0.024, LEG_SHIN_LEN * 0.85, 5), MAT.copper);
    shinRod.position.set(spec.side * 0.05, -LEG_SHIN_LEN * 0.48, -0.08);
    kneePivot.add(shinRod);

    // Ankle & Rugged Clawed / Padded Mechanical Hound Foot
    const footPivot = new THREE.Group();
    footPivot.position.set(0, -LEG_SHIN_LEN, 0);
    kneePivot.add(footPivot);

    const ankleBall = makeMesh(new THREE.OctahedronGeometry(0.08, 0), MAT.titanium);
    footPivot.add(ankleBall);

    // Rubber-padded mechanical sole block
    const pawPad = makeMesh(new THREE.BoxGeometry(0.18, LEG_PAW_HEIGHT, 0.28), MAT.darkChassis);
    pawPad.position.set(0, -LEG_PAW_HEIGHT * 0.5, 0.06);
    footPivot.add(pawPad);

    // Twin angular front mechanical claws
    [-0.06, 0.06].forEach((cx) => {
      const claw = makeMesh(new THREE.ConeGeometry(0.042, 0.14, 4), MAT.chromePiston);
      claw.rotation.x = Math.PI / 2 + 0.22;
      claw.position.set(cx, -0.04, 0.22);
      footPivot.add(claw);
    });

    // Rear stabilizer spur
    const heelSpur = makeMesh(new THREE.BoxGeometry(0.10, 0.07, 0.12), MAT.titanium);
    heelSpur.position.set(0, -0.04, -0.10);
    footPivot.add(heelSpur);

    roboLegs.push({
      spec,
      hipMount,
      abductPivot,
      thighPivot,
      kneePivot,
      footPivot,
    });
  });

  /**
   * Exact kinematic stance solver so all 4 mechanical paws remain solidly planted
   * on y = 0 in IDLE & OVERDRIVE, and execute realistic cyclic stepping in PROWL!
   */
  function applyRoboLegPose(leg, thighAngle, kneeAngle, abductAngle = 0) {
    leg.abductPivot.rotation.z = leg.spec.side * abductAngle;
    leg.thighPivot.rotation.x = thighAngle;
    leg.kneePivot.rotation.x = kneeAngle;
    // Counter-rotate foot so sole stays flat to ground
    leg.footPivot.rotation.x = -(thighAngle + kneeAngle);
  }

  function computeIdleBodyY(thighA, kneeA) {
    const drop =
      LEG_THIGH_LEN * Math.cos(thighA) +
      LEG_SHIN_LEN * Math.cos(thighA + kneeA) +
      LEG_PAW_HEIGHT;
    return drop - HIP_LOCAL_Y;
  }

  // -------------------------------------------------------------------------
  // 5.6 THUNDER ARC VFX (`thunderVfxGroup`)
  // -------------------------------------------------------------------------
  const thunderVfxGroup = new THREE.Group();
  thunderVfxGroup.name = 'thunderVfxGroup';
  bodyRigGroup.add(thunderVfxGroup);

  // Reusable low-poly segmented lightning bolts (crisp glowing thin rectangular bars)
  const BOLT_SEGMENTS = 7;
  const BOLT_DEFINITIONS = [
    // Crest to Dorsal Reactor
    { a: new THREE.Vector3(0, 1.98, 0.66), b: new THREE.Vector3(0, 1.16, -0.22) },
    // Dorsal Reactor to Left Railgun Coils
    { a: new THREE.Vector3(0.28, 1.12, -0.22), b: new THREE.Vector3(1.36, 0.28, 0.78) },
    // Dorsal Reactor to Right Minigun Shroud
    { a: new THREE.Vector3(-0.28, 1.12, -0.22), b: new THREE.Vector3(-1.36, 0.30, 0.72) },
    // Crest to Right Temple Antenna
    { a: new THREE.Vector3(-0.08, 1.88, 0.62), b: new THREE.Vector3(-0.68, 1.72, 0.56) },
    // Railgun Front Coils arc
    { a: new THREE.Vector3(1.36, 0.42, 0.54), b: new THREE.Vector3(1.36, 0.14, 1.24) },
  ];

  const boltSegGeo = new THREE.BoxGeometry(0.032, 0.032, 1.0);
  const lightningBolts = BOLT_DEFINITIONS.map((def, bIdx) => {
    const group = new THREE.Group();
    group.name = `ThunderBolt_${bIdx}`;
    const segs = [];
    for (let i = 0; i < BOLT_SEGMENTS; i++) {
      const seg = new THREE.Mesh(boltSegGeo, MAT.thunderBolt);
      group.add(seg);
      segs.push(seg);
    }
    thunderVfxGroup.add(group);
    return { def, group, segs, nextRefresh: 0 };
  });

  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _vMid = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _vUp = new THREE.Vector3(0, 0, 1);

  /**
   * Rebuilds jagged midpoint-displaced lightning segments between two anchors.
   */
  function regenerateBolt(bolt, jitterAmt = 0.14, thickness = 1.0) {
    const pts = [];
    for (let i = 0; i <= BOLT_SEGMENTS; i++) {
      const t = i / BOLT_SEGMENTS;
      const p = new THREE.Vector3().lerpVectors(bolt.def.a, bolt.def.b, t);
      if (i > 0 && i < BOLT_SEGMENTS) {
        p.x += (Math.random() - 0.5) * 2 * jitterAmt;
        p.y += (Math.random() - 0.5) * 2 * jitterAmt;
        p.z += (Math.random() - 0.5) * 2 * jitterAmt;
      }
      pts.push(p);
    }

    for (let i = 0; i < BOLT_SEGMENTS; i++) {
      _vA.copy(pts[i]);
      _vB.copy(pts[i + 1]);
      const dist = _vA.distanceTo(_vB);
      _vMid.addVectors(_vA, _vB).multiplyScalar(0.5);
      _vDir.subVectors(_vB, _vA).normalize();

      const seg = bolt.segs[i];
      seg.position.copy(_vMid);
      seg.scale.set(thickness, thickness, Math.max(dist, 0.01));
      seg.quaternion.setFromUnitVectors(_vUp, _vDir);
    }
  }

  // Low-Poly Tetrahedron Energy Sparks drifting upward
  const SPARK_COUNT = 28;
  const sparkGeo = new THREE.TetrahedronGeometry(0.052, 0);
  const sparks = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const m = new THREE.Mesh(sparkGeo, i % 3 === 0 ? MAT.sparkYellow : MAT.sparkCyan);
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.55 + Math.random() * 1.15;
    m.position.set(Math.cos(angle) * radius, Math.random() * 2.2 - 0.3, Math.sin(angle) * radius);
    thunderVfxGroup.add(m);
    sparks.push({
      mesh: m,
      speed: 0.75 + Math.random() * 1.35,
      angle,
      radius,
      spinX: (Math.random() - 0.5) * 6,
      spinY: (Math.random() - 0.5) * 6,
      lifeOffset: Math.random(),
    });
  }


  // =========================================================================
  // 6. STATE (every module stays equipped; the page picks the mode)
  // =========================================================================

  const appState = {
    mode: 'idle', // 'idle' | 'prowl' | 'overdrive'
    modules: { roboLegs: true, weapons: true, cyberArmor: true, thunderVfx: true },
  };

  function syncModuleVisibility() {
    classicFeetGroup.visible = false;
  }

  // A poke or the evolution itself: squash, shockwave, every arc at once.
  const shockRingMat = new THREE.MeshBasicMaterial({
    color: 0x00F0FF,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.92, 8), shockRingMat);
  shockRing.rotation.x = -Math.PI / 2;
  shockRing.position.y = 1.25;
  shockRing.visible = false;
  scene.add(shockRing);

  const BURST_TIME = 0.45;
  let burstTimer = 0;
  let running = false;
  let frame = 0;

  function applyBurst(dt) {
    if (burstTimer <= 0) return;
    burstTimer = Math.max(0, burstTimer - dt);
    const p = 1 - burstTimer / BURST_TIME;
    const bounce = Math.sin(p * Math.PI * 2.5) * (1 - p);
    bodyRigGroup.scale.set(1 - bounce * 0.12, 1 + bounce * 0.22, 1 - bounce * 0.12);
    shockRing.scale.setScalar(0.4 + p * 3.2);
    shockRingMat.opacity = (1 - p) * 0.8;
    strobeLight.color.setHex(0x00F0FF);
    strobeLight.intensity = Math.max(strobeLight.intensity, (1 - p) * 6.5);
    lightningBolts.forEach((bolt) => {
      bolt.group.visible = true;
      regenerateBolt(bolt, 0.22, 1.4);
    });
    if (burstTimer === 0) {
      bodyRigGroup.scale.setScalar(1);
      shockRing.visible = false;
    }
  }

  function triggerBurst() {
    burstTimer = BURST_TIME;
    shockRing.visible = true;
  }

  // =========================================================================
  // 8. ANIMATION LOOP (IDLE SCAN / ROBO-DOG PROWL / FULL OVERDRIVE)
  // =========================================================================

  const clock = new THREE.Clock();
  let elapsed = 0;
  let minigunSpinSpeed = 0;
  let railgunChargeTimer = 0;
  let railgunRecoilOffset = 0;

  // Initialize default visibility & telemetry
  syncModuleVisibility();

  // Base stance angles (front knees bend backward like Boston Dynamics Spot, rear knees reverse-jointed)
  const BASE_FRONT_THIGH = 0.42;
  const BASE_FRONT_KNEE = -0.84;
  const BASE_REAR_THIGH = -0.42;
  const BASE_REAR_KNEE = 0.84;

  // Exact grounded idle height for Robo-Dog mode
  const EXACT_ROBO_IDLE_Y = computeIdleBodyY(BASE_FRONT_THIGH, BASE_FRONT_KNEE);

  function animate() {
    if (!running) return;
    frame = requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    const mode = appState.mode;
    const hasRoboLegs = appState.modules.roboLegs;

    // -----------------------------------------------------------------------
    // A. MODE-SPECIFIC KINEMATICS & CHASSIS MOTION
    // -----------------------------------------------------------------------
    if (mode === 'idle') {
      // Gentle mechanical breathing bob
      const breath = Math.sin(elapsed * 2.1) * 0.032;
      const targetY = hasRoboLegs ? EXACT_ROBO_IDLE_Y + breath : CLASSIC_BODY_Y + breath * 0.6;
      bodyRigGroup.position.y = THREE.MathUtils.lerp(bodyRigGroup.position.y, targetY, 0.14);
      bodyRigGroup.rotation.x = THREE.MathUtils.lerp(bodyRigGroup.rotation.x, Math.sin(elapsed * 1.1) * 0.02, 0.1);
      bodyRigGroup.rotation.z = THREE.MathUtils.lerp(bodyRigGroup.rotation.z, Math.sin(elapsed * 0.8) * 0.018, 0.1);

      // Head scanning side-to-side with inquisitive cyber-duck tilt
      headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, Math.sin(elapsed * 0.95) * 0.48, 0.08);
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, Math.sin(elapsed * 1.9) * 0.07, 0.08);
      headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, Math.sin(elapsed * 0.95) * 0.06, 0.08);

      // Subtle knee flex absorbing breathing while paws stay grounded
      if (hasRoboLegs) {
        const flex = -breath * 0.65;
        roboLegs.forEach((leg) => {
          if (leg.spec.isFront) {
            applyRoboLegPose(leg, BASE_FRONT_THIGH + flex, BASE_FRONT_KNEE - flex * 2, 0.05);
          } else {
            applyRoboLegPose(leg, BASE_REAR_THIGH - flex, BASE_REAR_KNEE + flex * 2, 0.05);
          }
        });
      }

      // Calm laser & weapons
      laserBeamGroup.scale.set(1, 1, 1);
      MAT.laserBeam.opacity = 0.28 + Math.sin(elapsed * 5.0) * 0.05;
      minigunSpinSpeed = THREE.MathUtils.lerp(minigunSpinSpeed, 0.35, 0.06);
      minigunRecoilGroup.position.z = THREE.MathUtils.lerp(minigunRecoilGroup.position.z, 0.12, 0.15);
      railgunRecoilGroup.position.z = THREE.MathUtils.lerp(railgunRecoilGroup.position.z, 0.12, 0.15);
      muzzleFlashGroup.visible = false;
      muzzleLight.intensity = THREE.MathUtils.lerp(muzzleLight.intensity, 0, 0.2);
      strobeLight.intensity = THREE.MathUtils.lerp(strobeLight.intensity, 0, 0.15);

      // Calm thrusters
      thrusterGlowMeshes.forEach((tg) => {
        tg.scale.set(0.7, 0.55 + Math.sin(elapsed * 6) * 0.08, 0.7);
      });
    } else if (mode === 'prowl') {
      // Synchronized 4-leg cyberpunk robo-dog trotting / prowling gait
      const gaitFreq = 6.8;
      const tGait = elapsed * gaitFreq;

      const strideBounce = Math.abs(Math.sin(tGait)) * 0.095;
      const prowlBaseY = hasRoboLegs ? EXACT_ROBO_IDLE_Y - 0.12 + strideBounce : CLASSIC_BODY_Y + strideBounce * 0.8;
      bodyRigGroup.position.y = THREE.MathUtils.lerp(bodyRigGroup.position.y, prowlBaseY, 0.22);

      // Aggressive forward predator pitch & subtle gait roll
      bodyRigGroup.rotation.x = THREE.MathUtils.lerp(bodyRigGroup.rotation.x, 0.11 + Math.sin(tGait * 2) * 0.03, 0.15);
      bodyRigGroup.rotation.z = THREE.MathUtils.lerp(bodyRigGroup.rotation.z, Math.sin(tGait) * 0.045, 0.15);

      // Head stabilizes forward locked onto prey
      headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, Math.sin(tGait * 0.5) * 0.12, 0.12);
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -0.09, 0.12);
      headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, -bodyRigGroup.rotation.z * 0.6, 0.12);

      if (hasRoboLegs) {
        roboLegs.forEach((leg) => {
          const p = tGait + leg.spec.phase;
          const swing = Math.sin(p);
          const lift = Math.max(0, Math.cos(p)); // Asymmetric foot lift during swing phase

          if (leg.spec.isFront) {
            const thighA = BASE_FRONT_THIGH + 0.08 + swing * 0.44;
            const kneeA = BASE_FRONT_KNEE - 0.14 - lift * 0.46;
            applyRoboLegPose(leg, thighA, kneeA, 0.08);
          } else {
            const thighA = BASE_REAR_THIGH - 0.08 + swing * 0.44;
            const kneeA = BASE_REAR_KNEE + 0.14 + lift * 0.46;
            applyRoboLegPose(leg, thighA, kneeA, 0.08);
          }
        });
      } else {
        // Comedic waddle if classic duck feet are equipped in prowl mode
        classicFeetGroup.children.forEach((f, idx) => {
          f.rotation.x = Math.sin(tGait + idx * Math.PI) * 0.48;
        });
      }

      // Scroll floor grid smoothly backward to convey prowling forward velocity
      cyberGrid.position.z = ((cyberGrid.position.z - dt * 3.6) % 1.0);

      // Pulsing thrusters & moderate alert laser
      thrusterGlowMeshes.forEach((tg) => {
        const pulse = 1.05 + Math.sin(elapsed * 18) * 0.25;
        tg.scale.set(0.95, pulse, 0.95);
      });
      laserBeamGroup.scale.set(1.1, 1.1, 1.08);
      MAT.laserBeam.opacity = 0.38;
      minigunSpinSpeed = THREE.MathUtils.lerp(minigunSpinSpeed, 3.2, 0.08);
      minigunRecoilGroup.position.z = THREE.MathUtils.lerp(minigunRecoilGroup.position.z, 0.12, 0.15);
      railgunRecoilGroup.position.z = THREE.MathUtils.lerp(railgunRecoilGroup.position.z, 0.12, 0.15);
      muzzleFlashGroup.visible = false;
      muzzleLight.intensity = THREE.MathUtils.lerp(muzzleLight.intensity, 0, 0.2);
      strobeLight.intensity = THREE.MathUtils.lerp(strobeLight.intensity, 0.6, 0.1);
      strobeLight.color.setHex(0x00F0FF);
    } else if (mode === 'overdrive') {
      // Crouched, braced heavy weapons firing stance!
      const jitter = (Math.random() - 0.5) * 0.018;
      const crouchY = hasRoboLegs ? EXACT_ROBO_IDLE_Y - 0.22 : CLASSIC_BODY_Y - 0.04;
      bodyRigGroup.position.y = THREE.MathUtils.lerp(bodyRigGroup.position.y, crouchY + jitter, 0.22);
      bodyRigGroup.rotation.x = THREE.MathUtils.lerp(bodyRigGroup.rotation.x, 0.14 + jitter * 1.4, 0.18);
      bodyRigGroup.rotation.z = THREE.MathUtils.lerp(bodyRigGroup.rotation.z, jitter * 1.2, 0.18);

      // Maniacal slight target sweep & recoil vibration
      headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, Math.sin(elapsed * 2.6) * 0.22 + jitter, 0.14);
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -0.10, 0.15);
      headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, Math.sin(elapsed * 5.2) * 0.05, 0.15);

      // Wide splayed armored stance
      if (hasRoboLegs) {
        roboLegs.forEach((leg) => {
          if (leg.spec.isFront) {
            applyRoboLegPose(leg, BASE_FRONT_THIGH + 0.26, BASE_FRONT_KNEE - 0.52, 0.22);
          } else {
            applyRoboLegPose(leg, BASE_REAR_THIGH - 0.26, BASE_REAR_KNEE + 0.52, 0.22);
          }
        });
      }

      // Rapid Minigun Barrel Spin + Recoil Kickback + Flickering Spiky Muzzle Flash
      minigunSpinSpeed = THREE.MathUtils.lerp(minigunSpinSpeed, 30.0, 0.15);
      const fireKick = Math.sin(elapsed * 56) * 0.065;
      minigunRecoilGroup.position.z = 0.05 + fireKick;

      const flashOn = appState.modules.weapons && Math.sin(elapsed * 72) > -0.25;
      muzzleFlashGroup.visible = flashOn;
      if (flashOn) {
        muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
        const sc = 0.85 + Math.random() * 0.55;
        muzzleFlashGroup.scale.set(sc, sc, 0.9 + Math.random() * 0.5);
        muzzleFlashGroup.getWorldPosition(muzzleLight.position);
        muzzleLight.intensity = 4.2 + Math.random() * 2.5;
      } else {
        muzzleLight.intensity = 0.3;
      }

      // Periodic Thunder Railgun Electromagnetic Burst Recoil
      railgunChargeTimer += dt;
      if (railgunChargeTimer > 1.15) {
        railgunChargeTimer = 0;
        railgunRecoilOffset = -0.24;
      }
      railgunRecoilOffset = THREE.MathUtils.lerp(railgunRecoilOffset, 0, 0.12);
      railgunRecoilGroup.position.z = 0.12 + railgunRecoilOffset;

      // Railgun coils surge before firing
      const chargeIntensity = 1.6 + (railgunChargeTimer / 1.15) * 3.0;
      MAT.cyanGlow.emissiveIntensity = chargeIntensity;

      // Laser sight flares aggressively
      const laserFlare = 1.45 + Math.sin(elapsed * 32) * 0.28;
      laserBeamGroup.scale.set(laserFlare, laserFlare, 1.2);
      MAT.laserBeam.opacity = 0.52;

      // Alternating Red / Cyan Warning Strobe Light
      const isRedStrobe = Math.floor(elapsed * 7.5) % 2 === 0;
      strobeLight.color.setHex(isRedStrobe ? 0xFF1E42 : 0x00F0FF);
      strobeLight.intensity = 2.6 + Math.sin(elapsed * 24) * 0.9;

      // Full burn thrusters
      thrusterGlowMeshes.forEach((tg) => {
        const flare = 1.35 + Math.random() * 0.45;
        tg.scale.set(1.1, flare, 1.1);
      });
    }

    // Reset cyan emissive back to crisp standard when not in overdrive
    if (mode !== 'overdrive') {
      MAT.cyanGlow.emissiveIntensity = 1.9 + Math.sin(elapsed * 4.0) * 0.25;
    }

    // -----------------------------------------------------------------------
    // B. CONTINUOUS MECHANICAL DETAILS (BARRELS, REACTOR RINGS, LIGHTS)
    // -----------------------------------------------------------------------
    minigunBarrelCluster.rotation.z += minigunSpinSpeed * dt;

    const ringMult = mode === 'overdrive' ? 4.2 : mode === 'prowl' ? 2.0 : 1.0;
    reactorRingOuter.rotation.z += 1.2 * ringMult * dt;
    reactorRingInner.rotation.z -= 2.1 * ringMult * dt;
    reactorCore.rotation.y += 1.8 * ringMult * dt;
    reactorCore.rotation.x += 0.9 * ringMult * dt;

    // Keep reactor point light anchored to reactor world position
    reactorCore.getWorldPosition(reactorPointLight.position);
    reactorPointLight.intensity = appState.modules.cyberArmor
      ? (mode === 'overdrive' ? 3.2 : 1.8)
      : 0;

    // -----------------------------------------------------------------------
    // C. PROCEDURAL THUNDER ARC LIGHTNING & TETRAHEDRON ENERGY SPARKS
    // -----------------------------------------------------------------------
    if (appState.modules.thunderVfx) {
      const arcRate = mode === 'overdrive' ? 0.045 : mode === 'prowl' ? 0.11 : 0.18;
      const arcVisibleChance = mode === 'overdrive' ? 0.92 : mode === 'prowl' ? 0.58 : 0.36;
      const jitter = mode === 'overdrive' ? 0.20 : 0.12;
      const thick = mode === 'overdrive' ? 1.35 : 0.85;

      lightningBolts.forEach((bolt, idx) => {
        // Hide weapon-anchored bolts if weapons are disabled
        if (!appState.modules.weapons && (idx === 1 || idx === 2 || idx === 4)) {
          bolt.group.visible = false;
          return;
        }
        if (elapsed >= bolt.nextRefresh) {
          bolt.nextRefresh = elapsed + arcRate * (0.6 + Math.random() * 0.9);
          const active = Math.random() < arcVisibleChance;
          bolt.group.visible = active;
          if (active) {
            regenerateBolt(bolt, jitter, thick);
          }
        }
      });

      // Drifting low-poly tetrahedron sparks
      const sparkSpeedMult = mode === 'overdrive' ? 2.6 : mode === 'prowl' ? 1.4 : 0.65;
      sparks.forEach((sp, idx) => {
        // In IDLE, show only a subtle subset of sparks; in OVERDRIVE unleash all
        const showSpark = mode === 'overdrive' || (mode === 'prowl' && idx % 2 === 0) || idx % 4 === 0;
        sp.mesh.visible = showSpark;
        if (!showSpark) return;

        sp.mesh.position.y += sp.speed * sparkSpeedMult * dt;
        sp.mesh.rotation.x += sp.spinX * dt;
        sp.mesh.rotation.y += sp.spinY * dt;

        if (sp.mesh.position.y > 2.35) {
          sp.mesh.position.y = -0.35;
          const ang = Math.random() * Math.PI * 2;
          const rad = 0.45 + Math.random() * 1.15;
          sp.mesh.position.x = Math.cos(ang) * rad;
          sp.mesh.position.z = Math.sin(ang) * rad;
        }
        const scalePulse = mode === 'overdrive' ? 1.25 : 0.82;
        sp.mesh.scale.setScalar(scalePulse * (1.0 - Math.max(0, (sp.mesh.position.y - 1.5) / 1.0)));
      });
    }

    // Subtle tactical floor ring rotation
    outerTickGroup.rotation.y += (mode === 'overdrive' ? 0.55 : 0.12) * dt;

    applyBurst(dt);
    pace();
    controls.update();
    renderer.render(scene, camera);
  }

  const MODES = ['idle', 'prowl', 'overdrive'];

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
      appState.mode = MODES[tier];
    },
    quack: triggerBurst,
    reveal() {
      triggerBurst();
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
