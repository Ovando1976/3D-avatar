"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Html,
  Environment,
  ContactShadows,
  useGLTF,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Physics,
  RigidBody,
  CapsuleCollider,
  CuboidCollider,
} from "@react-three/rapier";
import { useAzureTTS } from "@/hooks/useAzureTTS";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

/* ======================== Config ======================== */
const AVATAR_URL = process.env.NEXT_PUBLIC_RPM_CHEF_URL || "/models/chef.glb";
// Default to your serving room; override with NEXT_PUBLIC_KITCHEN_URL if needed
const KITCHEN_URL =
  process.env.NEXT_PUBLIC_KITCHEN_URL || "/models/the_serving_room.glb";
const STAGE_Y = -0.25;

// Spawn on far side of island (x can be nudged; z computed from counter)
const CHEF_SPAWN_X = -0.25;

// Global yaw (radians)
const YAW_RIGHT_90 = -Math.PI / 2; // +90° clockwise
const YAW_OFFSET = YAW_RIGHT_90; // apply right-turn globally

// Soft nav bounds (tune for your GLB)
const NAV_BOUNDS = { minX: -2.2, maxX: 2.2, minZ: -3.0, maxZ: 1.2 };

// Defaults (camera ultimately tracks targetY)
const CAMERA = {
  pos: [0.86, 1.55, -2.2] as [number, number, number], // flipped to opposite side (negative Z)
  fov: 32,
  target: [0, 1.55, -0.18] as [number, number, number],
};
const CAMERA_TARGET_OFFSET = 0.26;

const CHIPS = [
  "All",
  "STT",
  "STX",
  "STJ",
  "Seafood",
  "Bakery",
  "Vegan",
  "No Dairy",
];

/* ======================== Types & Demo Data ======================== */
export type VisemeWeights = Record<string, number>;
type Step = { i: number; text: string };
type Recipe = {
  id: string;
  title: string;
  tags: string[];
  allergens?: string[];
  kcal?: number;
  steps: Step[];
};

const RECIPES: Recipe[] = [
  {
    id: "fungi-and-fish",
    title: "Fungi & Stewed Fish",
    tags: ["STT", "Seafood", "Traditional"],
    allergens: ["fish", "corn"],
    kcal: 520,
    steps: [
      { i: 1, text: "Soak saltfish in cold water 30–60 min." },
      { i: 2, text: "Simmer saltfish 10–12 min, then drain." },
      { i: 3, text: "Whisk cornmeal into okra water; stir until glossy." },
      { i: 4, text: "Sauté aromatics; add flaked fish; simmer with thyme." },
      { i: 5, text: "Plate fungi with stewed fish; finish with lime." },
    ],
  },
  {
    id: "johnny-cakes",
    title: "Johnny Cakes",
    tags: ["STX", "Bakery", "StreetFood"],
    allergens: ["gluten", "dairy"],
    kcal: 320,
    steps: [
      { i: 1, text: "Whisk dry ingredients." },
      { i: 2, text: "Cut in butter; add milk; form dough." },
      { i: 3, text: "Rest 15 min; divide and flatten." },
      { i: 4, text: "Shallow-fry until golden on both sides." },
      { i: 5, text: "Drain and serve warm." },
    ],
  },
  {
    id: "beef-pate",
    title: "Beef Pate",
    tags: ["STT", "StreetFood"],
    allergens: ["gluten"],
    kcal: 410,
    steps: [
      { i: 1, text: "Make pastry; chill 20 min." },
      { i: 2, text: "Brown beef with onion, garlic, curry." },
      { i: 3, text: "Roll dough; fill; crimp." },
      { i: 4, text: "Fry 170–180°C until golden." },
    ],
  },
];

/* ======================== Utils ======================== */
function cx(...arr: (string | false | null | undefined)[]) {
  return arr.filter(Boolean).join(" ");
}
function mapAzureViseme(id?: number): VisemeWeights {
  const w: VisemeWeights = { jawOpen: 0, mouthClose: 1, viseme_PP: 0 };
  if (id == null) return w;
  const open = new Set([4, 5, 8, 9, 12, 15, 18]);
  const bilabial = new Set([0, 1]);
  if (open.has(id)) {
    w.jawOpen = 1;
    w.mouthClose = 0;
  }
  if (bilabial.has(id)) w.viseme_PP = 1;
  return w;
}

/* Minimal caption streamer hook */
function useCaptionStreamer(text: string, enabled: boolean) {
  const [partial, setPartial] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled || !text) return;
    setPartial("");
    let i = 0;
    const words = text.split(" ");
    theLoop();
    function theLoop() {
      if (i < words.length) {
        setPartial((p) => (p ? p + " " : "") + words[i++]);
        window.setTimeout(theLoop, 120);
      } else {
        setFinals((f) => [...f, text]);
        setPartial("");
      }
    }
    return () => setPartial("");
  }, [text, enabled]);
  return { partial, finals };
}

/* ======================== Debug mesh picker UI ======================== */
function useLocal<T>(key: string, init: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

const DEFAULT_TARGET_Y = 1.45;

function useChefEnvironment() {
  const [env, setEnv] = useState<ChefEnvironmentState>({
    floorY: null,
    floorYAtSpawn: null,
    counterY: null,
    ceilingY: null,
    counterFrontZ: null,
    counterDepth: null,
    doorHeight: null,
    targetY: DEFAULT_TARGET_Y,
  });

  const handleReady = useCallback((info: KitchenReadyInfo) => {
    setEnv((prev) => ({
      ...prev,
      floorY: info.floorY,
      floorYAtSpawn: info.floorYAtSpawn,
      counterY: info.counterY,
      ceilingY: info.ceilingY,
      counterFrontZ: info.counterFrontZ,
      counterDepth: info.counterDepth,
      doorHeight: info.doorHeight || null,
      targetY: (info.counterY ?? DEFAULT_TARGET_Y) + CAMERA_TARGET_OFFSET,
    }));
  }, []);

  const setTargetY = useCallback((next: number) => {
    setEnv((prev) => ({ ...prev, targetY: next }));
  }, []);

  return { env, handleReady, setTargetY };
}

type MeshInfo = {
  name: string;
  topY: number;
  minY: number;
  maxY: number;
  frontZ: number;
  depth: number;
  width: number;
};

type KitchenReadyInfo = {
  floorY: number;
  floorYAtSpawn: number;
  counterY: number;
  ceilingY: number;
  counterFrontZ: number;
  counterDepth: number;
  scale: number;
  doorHeight: number;
};

type ChefEnvironmentState = {
  floorY: number | null;
  floorYAtSpawn: number | null;
  counterY: number | null;
  ceilingY: number | null;
  counterFrontZ: number | null;
  counterDepth: number | null;
  doorHeight: number | null;
  targetY: number;
};

function DebugPicker({
  meshes,
  floorName,
  setFloorName,
  counterName,
  setCounterName,
}: {
  meshes: MeshInfo[];
  floorName: string | null;
  setFloorName: (s: string | null) => void;
  counterName: string | null;
  setCounterName: (s: string | null) => void;
}) {
  const sorted = [...meshes].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="pointer-events-auto absolute left-6 top-6 z-10 rounded-xl border border-emerald-200 bg-white/90 p-3 text-xs text-neutral-800 shadow">
      <div className="mb-2 font-semibold">Kitchen Mesh Picker</div>
      <div className="mb-2">
        <div className="mb-1">Floor mesh</div>
        <select
          className="w-64 rounded border border-emerald-300 bg-white px-2 py-1"
          value={floorName ?? ""}
          onChange={(e) => setFloorName(e.target.value || null)}
        >
          <option value="">Auto (min Y)</option>
          {sorted.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} (minY {m.minY.toFixed(2)})
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <div className="mb-1">Counter top mesh</div>
        <select
          className="w-64 rounded border border-emerald-300 bg-white px-2 py-1"
          value={counterName ?? ""}
          onChange={(e) => setCounterName(e.target.value || null)}
        >
          <option value="">Auto (height heuristic)</option>
          {sorted.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} (topY {m.topY.toFixed(2)})
            </option>
          ))}
        </select>
      </div>
      <div className="text-[11px] text-neutral-600">
        Tips: pick the room <b>floor</b> and the island <b>counter top</b>.
        Choices persist.
      </div>
    </div>
  );
}

/* ============ Bone logger (client-side, no server fetch) ============ */
function BoneLogger({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const [first20, setFirst20] = useState<string[] | null>(null);

  useEffect(() => {
    const bones: string[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Bone) bones.push(obj.name);
    });
    const out = bones.slice(0, 20);
    setFirst20(out);
    console.log("[RPM Bones]", out);
  }, [scene]);

  if (!first20) return null;
  return (
    <Html position={[0, 2.2, 0]}>
      <div className="rounded-md bg-black/60 px-2 py-1 text-[10px] text-white">
        Bones: {first20.join(", ")}
      </div>
    </Html>
  );
}
useGLTF.preload(AVATAR_URL);
useGLTF.preload(KITCHEN_URL);

/* ======================== Kitchen ======================== */
function KitchenScene({
  url,
  onReady,
  onCatalog,
  preferredFloor,
  preferredCounter,
  showBoneLogger = false,
}: {
  url: string;
  onReady?: (info: KitchenReadyInfo) => void;
  onCatalog?: (meshes: MeshInfo[]) => void;
  preferredFloor?: string | null;
  preferredCounter?: string | null;
  showBoneLogger?: boolean;
}) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((o: any) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m: any) => {
        if (!m) return;
        m.depthWrite = true;
        m.depthTest = true;
      });
    });
  }, [scene]);

  function meshCatalog(): MeshInfo[] {
    const list: MeshInfo[] = [];
    scene.traverse((o: any) => {
      if (!o.isMesh) return;
      const name = o.name || "";
      const box = new THREE.Box3().setFromObject(o);
      const width = Math.abs(box.max.x - box.min.x);
      const depth = Math.abs(box.max.z - box.min.z);
      const minY = box.min.y,
        maxY = box.max.y,
        topY = maxY;
      const frontZ = Math.max(box.max.z, box.min.z);
      list.push({ name, topY, minY, maxY, frontZ, depth, width });
    });
    return list;
  }

  function pickCounter(list: MeshInfo[], counterY: number) {
    if (preferredCounter) {
      const hit = list.find((m) => m.name === preferredCounter);
      if (hit) return { frontZ: hit.frontZ, depth: hit.depth };
    }
    let best: MeshInfo | null = null;
    for (const m of list) {
      const height = m.maxY - m.minY;
      const nearCounter =
        Math.abs(m.topY - counterY) <= 0.12 ||
        Math.abs((m.minY + m.maxY) / 2 - counterY) <= 0.18;
      const plausible = height <= 0.2 && m.width >= 0.6 && m.depth >= 0.4;
      if (!nearCounter || !plausible) continue;
      if (
        !best ||
        m.frontZ > best.frontZ ||
        (Math.abs(m.frontZ - best.frontZ) < 0.02 &&
          m.width * m.depth > best.width * best.depth)
      ) {
        best = m;
      }
    }
    return best
      ? { frontZ: best.frontZ, depth: best.depth }
      : { frontZ: 0.25, depth: 0.6 };
  }

  function detectDoorHeight(list: MeshInfo[]): number | null {
    const candidates = list.filter((m) => {
      const name = (m.name || "").toLowerCase();
      const isDoorName = /door/.test(name);
      const height = m.maxY - m.minY;
      const tall = height > 1.8;
      const thinX = m.width < 1.2;
      const thinZ = m.depth < 0.6;
      return isDoorName || (tall && thinX && thinZ);
    });
    if (!candidates.length) return null;
    const explicit = candidates.filter((c) => /door/i.test(c.name));
    const arr = explicit.length ? explicit : candidates;
    const pick = arr.sort((a, b) => b.maxY - b.minY - (a.maxY - a.minY))[0];
    return pick ? pick.maxY - pick.minY : null;
  }

  function raycastFloorYAt(
    x: number,
    z: number,
    floorMeshName: string | null,
    ceilingY: number,
  ): number | null {
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(x, ceilingY + 5, z),
      new THREE.Vector3(0, -1, 0),
    );
    const target = floorMeshName ? scene.getObjectByName(floorMeshName) : null;
    const hits = raycaster.intersectObject(target ?? scene, true);
    return hits.length ? hits[0].point.y : null;
  }

  useEffect(() => {
    // Fit width and snap floor to STAGE_Y
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const targetWidth = 4.2;
    const scale = targetWidth / (size.x || 1);
    scene.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(scene);
    const c2 = new THREE.Vector3();
    box2.getCenter(c2);
    scene.position.x += -c2.x;
    scene.position.z += -c2.z;
    const minYAfterScale = box2.min.y;
    const deltaY = STAGE_Y - minYAfterScale;
    scene.position.y += deltaY;

    scene.updateMatrixWorld(true);

    // Catalog and measurements
    const list = meshCatalog();
    onCatalog?.(list);

    const floorY = STAGE_Y;
    const ceilingY = Math.max(...list.map((m) => m.maxY));
    const counterY = floorY + 0.95;
    const { frontZ, depth } = pickCounter(list, counterY);

    const margin = 0.1;
    const spawnZ = frontZ - depth - margin;
    const floorYAtSpawn =
      raycastFloorYAt(CHEF_SPAWN_X, spawnZ, null, ceilingY) ?? floorY;

    const doorH = detectDoorHeight(list) ?? 0;

    onReady?.({
      floorY,
      floorYAtSpawn,
      counterY,
      ceilingY,
      counterFrontZ: frontZ,
      counterDepth: depth,
      scale,
      doorHeight: doorH,
    });
  }, [scene]);

  return (
    <>
      <primitive object={scene} />
      {showBoneLogger ? <BoneLogger url={AVATAR_URL} /> : null}
    </>
  );
}

type ChefCanvasProps = {
  env: ChefEnvironmentState;
  onReady: (info: KitchenReadyInfo) => void;
  onCatalog?: (meshes: MeshInfo[]) => void;
  weights: VisemeWeights;
  floorName: string | null;
  counterName: string | null;
  recenterTick: number;
  showBoneLogger?: boolean;
  directionalLight?: { position: [number, number, number]; intensity?: number };
  contactShadow?: { scale?: number; blur?: number; far?: number };
};

function ChefCanvas({
  env,
  onReady,
  onCatalog,
  weights,
  floorName,
  counterName,
  recenterTick,
  showBoneLogger,
  directionalLight = { position: [-2.5, 4, -2], intensity: 1.4 },
  contactShadow = { scale: 7, blur: 2.6, far: 1.2 },
}: ChefCanvasProps) {
  const {
    floorY,
    floorYAtSpawn,
    counterY,
    ceilingY,
    counterFrontZ,
    counterDepth,
    doorHeight,
    targetY,
  } = env;

  return (
    <Canvas
      shadows
      camera={{
        position: [CAMERA.pos[0], targetY, CAMERA.pos[2]],
        fov: CAMERA.fov,
        near: 0.05,
        far: 60,
      }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true,
      }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#f6efe6"]} />
      <hemisphereLight intensity={0.35} />
      <directionalLight
        position={directionalLight.position}
        intensity={directionalLight.intensity ?? 1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Physics gravity={[0, -9.81, 0]} timeStep="vary">
        <RigidBody type="fixed" colliders="trimesh">
          <KitchenScene
            url={KITCHEN_URL}
            onCatalog={onCatalog}
            preferredFloor={floorName}
            preferredCounter={counterName}
            showBoneLogger={showBoneLogger}
            onReady={onReady}
          />
        </RigidBody>
        <CuboidCollider
          args={[10, 0.02, 10]}
          position={[0, (floorY ?? STAGE_Y) + 0.01, 0]}
        />

        <ChefAvatar
          key={`chef-${recenterTick}`}
          url={AVATAR_URL}
          weights={weights}
          floorY={floorY}
          floorYAtSpawn={floorYAtSpawn}
          counterY={counterY}
          ceilingY={ceilingY}
          counterFrontZ={counterFrontZ}
          counterDepth={counterDepth}
          doorHeight={doorHeight}
          floorMeshName={floorName ?? null}
          recenterTick={recenterTick}
        />
      </Physics>

      <Environment preset="sunset" />
      <ContactShadows
        position={[0, (floorY ?? STAGE_Y) + 0.001, 0]}
        opacity={0.25}
        scale={contactShadow.scale ?? 7}
        blur={contactShadow.blur ?? 2.6}
        far={contactShadow.far ?? 1.2}
      />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.07}
        minPolarAngle={1.48}
        maxPolarAngle={1.66}
        minDistance={1.8}
        maxDistance={3.4}
        target={[CAMERA.target[0], targetY, CAMERA.target[2]]}
      />
    </Canvas>
  );
}

/* ======================== Chef (kinematic; faces camera on spawn) ======================== */
function ChefAvatar({
  url,
  weights,
  floorY,
  floorYAtSpawn,
  counterY,
  ceilingY,
  counterFrontZ,
  counterDepth,
  floorMeshName,
  doorHeight,
  recenterTick,
}: {
  url: string;
  weights: VisemeWeights;
  floorY?: number | null;
  floorYAtSpawn?: number | null;
  counterY?: number | null;
  ceilingY?: number | null;
  counterFrontZ?: number | null;
  counterDepth?: number | null;
  floorMeshName?: string | null;
  doorHeight?: number | null;
  recenterTick: number;
}) {
  const body = useRef<any>(null);
  const group = useRef<THREE.Group>(null);
  const baseY = useRef<number>(STAGE_Y);
  const heading = useRef<number>(Math.PI);
  const { scene } = useGLTF(url);
  const { scene: rootScene, camera } = useThree();

  // WASD
  useEffect(() => {
    const store: Set<string> = (window as any)._keys ?? new Set();
    (window as any)._keys = store;
    const down = (e: KeyboardEvent) => store.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => store.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const rawBounds = useMemo(() => {
    scene.scale.setScalar(1);
    scene.position.set(0, 0, 0);
    scene.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(scene);
    return {
      height: Math.max(0.0001, box.max.y - box.min.y),
      footY: box.min.y,
    };
  }, [scene]);

  useEffect(() => {
    // ---- SCALE (door-first, then counter) ----
    const SCALE_BIAS = 1.08;
    let scale: number;

    if (doorHeight && doorHeight > 1.2) {
      const targetHuman = 0.86 * doorHeight;
      scale = (targetHuman / rawBounds.height) * SCALE_BIAS;
    } else if (counterY != null) {
      const FRACTION = 0.52;
      const desired = counterY - STAGE_Y;
      scale = (desired / (FRACTION * rawBounds.height)) * SCALE_BIAS;
    } else {
      scale = (1.72 / rawBounds.height) * SCALE_BIAS;
    }

    if (ceilingY != null) {
      const HEAD_CLEARANCE = 0.18;
      const maxScale = (ceilingY - HEAD_CLEARANCE - STAGE_Y) / rawBounds.height;
      scale = Math.min(scale, maxScale);
    }

    scene.scale.setScalar(scale);

    // ---- FLOOR LOCK & SPAWN using *precise* ground at spawn ----
    const groundY = floorYAtSpawn ?? floorY ?? STAGE_Y;
    const footYScaled = rawBounds.footY * scale;
    baseY.current = groundY - footYScaled + 0.0005;

    const margin = 0.1;
    const frontZ = counterFrontZ ?? 0.25;
    const depth = counterDepth ?? 0.6;
    const spawnZ = frontZ - depth - margin;

    body.current?.setNextKinematicTranslation({
      x: CHEF_SPAWN_X,
      y: baseY.current,
      z: spawnZ,
    });

    // Face the CAMERA on spawn
    const dxCam = camera.position.x - CHEF_SPAWN_X;
    const dzCam = camera.position.z - spawnZ;
    const yawToCamera = Math.atan2(dxCam, dzCam);

    heading.current = yawToCamera;
    if (group.current) {
      group.current.position.set(0, 0, 0);
      group.current.rotation.set(0, yawToCamera + YAW_OFFSET, 0);
    }
  }, [
    floorY,
    floorYAtSpawn,
    counterY,
    ceilingY,
    counterFrontZ,
    counterDepth,
    doorHeight,
    recenterTick,
    rawBounds.height,
    rawBounds.footY,
    scene,
    camera.position.x,
    camera.position.z,
  ]);

  // cache viseme targets
  const targets = useMemo(() => {
    const map = new Map<string, { mesh: THREE.SkinnedMesh; index: number }>();
    scene.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      const dict = (mesh as any)?.morphTargetDictionary as
        | Record<string, number>
        | undefined;
      if (!dict) return;
      Object.entries(dict).forEach(([name, idx]) =>
        map.set(name, { mesh, index: idx }),
      );
    });
    return map;
  }, [scene]);

  function groundYAt(x: number, z: number, ceiling: number): number | null {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, ceiling + 5, z),
      new THREE.Vector3(0, -1, 0),
    );
    const target =
      (floorMeshName ? rootScene.getObjectByName(floorMeshName) : null) ??
      rootScene;
    const hits = ray.intersectObject(target, true);
    return hits.length ? hits[0].point.y : null;
  }

  useFrame((_, dt) => {
    // ----- visemes (unchanged) -----
    targets.forEach(({ mesh, index }, name) => {
      const val =
        name === "jawOpen"
          ? (weights.jawOpen ?? 0)
          : name === "mouthClose"
          ? (weights.mouthClose ?? 0)
          : name.includes("viseme_PP")
          ? (weights.viseme_PP ?? 0)
          : 0;
      const inf = (mesh as any).morphTargetInfluences as number[] | undefined;
      if (Array.isArray(inf) && typeof inf[index] === "number") {
        inf[index] = THREE.MathUtils.lerp(inf[index] || 0, val, 0.35);
      }
    });

    if (!body.current || !group.current) return;

    // ----- movement (X/Z) -----
    const keys: Set<string> = (window as any)._keys ?? new Set();
    const t = body.current.translation();
    const speed = 1.0;
    let dx = 0,
      dz = 0;
    if (keys.has("w")) dz -= speed * dt;
    if (keys.has("s")) dz += speed * dt;
    if (keys.has("a")) dx -= speed * dt;
    if (keys.has("d")) dx += speed * dt;

    const sway = Math.sin(performance.now() * 0.0006) * 0.0005;
    let nx = t.x + dx + sway;
    let nz = t.z + dz;

    nx = Math.max(NAV_BOUNDS.minX, Math.min(NAV_BOUNDS.maxX, nx));
    nz = Math.max(NAV_BOUNDS.minZ, Math.min(NAV_BOUNDS.maxZ, nz));

    // ----- precise floor lock at current X/Z -----
    const ceiling = (ceilingY ?? 3) + 1;
    const gy = groundYAt(nx, nz, ceiling);
    if (gy != null) {
      const footOffset = group.current
        ? group.current.position.y - baseY.current
        : 0;
      const targetY = gy - footOffset + 0.0005;
      baseY.current = THREE.MathUtils.lerp(baseY.current, targetY, 0.5);
    }

    body.current.setNextKinematicTranslation({
      x: nx,
      y: baseY.current,
      z: nz,
    });

    // ----- face movement (+90° right) -----
    const mag = Math.hypot(dx, dz);
    if (mag > 0.0001) {
      const targetYaw = Math.atan2(dx, dz);
      const cur = group.current.rotation.y - YAW_OFFSET;
      const newYaw = THREE.MathUtils.lerp(cur, targetYaw, 0.22);
      group.current.rotation.y = newYaw + YAW_OFFSET;
    }
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.45, 0.18]} position={[0, 0.45, 0]} />
      <group ref={group}>
        <primitive object={scene} />
      </group>
    </RigidBody>
  );
}

/* ======================== Step Player ======================== */
function StepPlayer({
  steps,
  onSpeak,
}: {
  steps: Step[];
  onSpeak?: (t: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const step = steps[idx];
  const { partial } = useCaptionStreamer(step?.text ?? "", voiceOn);
  useEffect(() => {
    if (voiceOn && step?.text && onSpeak) onSpeak(step.text);
  }, [idx, voiceOn, step, onSpeak]);
  if (!step) return null;
  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-100 bg-white/70 p-6 shadow-lg backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Step {step.i}</h3>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full bg-emerald-100 px-3 py-1 text-sm hover:bg-emerald-200"
            onClick={() => setVoiceOn((v) => !v)}
          >
            {voiceOn ? "Voice: On" : "Voice: Off"}
          </button>
        </div>
      </div>
      <p className="min-h-[3rem] text-base leading-7">
        {partial ? <span className="animate-pulse">{partial}</span> : step.text}
      </p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          className="rounded-xl bg-neutral-100 px-4 py-2 hover:bg-emerald-200"
        >
          Prev
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(i + 1, steps.length - 1))}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ======================== Card ======================== */
function RecipeCard({ r, onOpen }: { r: Recipe; onOpen: (r: Recipe) => void }) {
  return (
    <button
      onClick={() => onOpen(r)}
      className="group w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white/80 text-left shadow transition hover:bg-emerald-100"
    >
      <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-rose-100 to-amber-100">
        <span className="text-6xl">🍽️</span>
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-neutral-800 group-hover:text-neutral-900">
          {r.title}
        </h4>
        <div className="mt-2 flex flex-wrap gap-1">
          {r.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 text-xs text-neutral-500">
          {r.kcal ?? "—"} kcal · Allergens: {r.allergens?.join(", ") ?? "None"}
        </div>
      </div>
    </button>
  );
}

/* ======================== Page ======================== */
export default function Page() {
  const [chip, setChip] = useState("All");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Recipe | null>(null);

  const { env, handleReady } = useChefEnvironment();
  const [recenter, setRecenter] = useState(0);

  // Mesh catalog + persisted picks
  const [meshCatalog, setMeshCatalog] = useState<MeshInfo[]>([]);
  const [floorName, setFloorName] = useLocal<string | null>(
    "usvi.floorName",
    null,
  );
  const [counterName, setCounterName] = useLocal<string | null>(
    "usvi.counterName",
    null,
  );
  const [showPicker, setShowPicker] = useLocal<boolean>("usvi.showPicker", false);

  const [ttsText, setTtsText] = useState<string | null>(null);
  const { speaking, visemeId, error } = useAzureTTS(ttsText);
  const weights = useMemo(
    () => mapAzureViseme(visemeId ?? undefined),
    [visemeId],
  );

  const filtered = useMemo(() => {
    let rows = RECIPES;
    if (chip !== "All") rows = rows.filter((r) => r.tags.includes(chip));
    if (query)
      rows = rows.filter((r) =>
        r.title.toLowerCase().includes(query.toLowerCase()),
      );
    return rows;
  }, [chip, query]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-50 via-emerald-50 to-sky-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-amber-100 bg-white/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🕊️</span>
            <div>
              <div className="font-extrabold tracking-tight">USVI Food</div>
              <div className="-mt-0.5 text-xs text-neutral-500">
                Taste the Islands
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-white"
              onClick={() =>
                setTtsText(
                  "Let’s cook fungi and fish. First, soak the saltfish for thirty minutes.",
                )
              }
            >
              Play Voice
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-neutral-900 md:text-5xl">
            Voice-guided Caribbean cooking with your 3D chef
          </h1>
          <p className="mt-4 text-neutral-600">
            Hands-free instructions, cultural tips, and a friendly avatar that
            talks you through every step. Find restaurants and events across St.
            Thomas, St. Croix, and St. John.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                className={cx(
                  "rounded-full border px-3 py-1.5",
                  chip === c
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-emerald-200 bg-white/80 hover:bg-emerald-50",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes…"
              className="w-full rounded-xl border border-amber-200 bg-white/80 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 md:w-80"
            />
            <button
              onClick={() => setRecenter((n) => n + 1)}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
              title="Teleport chef back to spawn"
            >
              Recenter Chef
            </button>
            <button
              className="rounded-lg border border-emerald-200 bg-white/90 px-3 py-2 text-sm text-emerald-700 transition hover:bg-emerald-50"
              onClick={() => setShowPicker((v) => !v)}
            >
              {showPicker ? "Hide Mesh Picker" : "Show Mesh Picker"}
            </button>
          </div>
        </div>

        {/* 3D Avatar Panel */}
        <div className="relative rounded-3xl border border-emerald-100 bg-white/60 p-6">
          {showPicker && meshCatalog.length > 0 && (
            <DebugPicker
              meshes={meshCatalog}
              floorName={floorName}
              setFloorName={setFloorName}
              counterName={counterName}
              setCounterName={setCounterName}
            />
          )}
          <div className="pointer-events-none absolute right-7 top-7 z-10 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">
            WASD to bump-test • Y locked to floor • Facing = movement + 90°
          </div>

          <div className="h-96 w-full overflow-hidden rounded-2xl border">
            <ChefCanvas
              env={env}
              onReady={handleReady}
              onCatalog={(list) => setMeshCatalog(list)}
              weights={weights}
              floorName={floorName}
              counterName={counterName}
              recenterTick={recenter}
              showBoneLogger={showPicker}
            />
          </div>

          <div className="mt-2 text-center text-xs text-neutral-600">
            {speaking ? "Speaking…" : "Idle"}{" "}
            {error && <span className="text-red-600">· {error}</span>}
          </div>
          <div className="mt-3 text-center text-sm text-neutral-600">
            “Wha you cooking today? Try fungi & fish — I’ll walk you through.”
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-4 text-xl font-bold">Featured Recipes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} r={r} onOpen={() => setOpen(r)} />
          ))}
        </div>
      </section>

      {/* Modal (same logic) */}
      {open && (
        <div className="fixed inset-0 z-20">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(null)}
          />
          <div className="absolute left-1/2 top-8 w-[min(92vw,880px)] -translate-x-1/2">
            <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white/90 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-4 border-b border-emerald-100 p-4">
                <div>
                  <h3 className="text-xl font-extrabold">{open.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {open.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setOpen(null)}
                  className="rounded-full bg-neutral-900 px-3 py-1.5 text-white"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <div className="h-56 w-full overflow-hidden rounded-2xl border">
                    <ChefCanvas
                      env={env}
                      onReady={handleReady}
                      weights={weights}
                      floorName={floorName}
                      counterName={counterName}
                      recenterTick={recenter}
                      directionalLight={{ position: [-2.2, 3.6, -1.8], intensity: 1.3 }}
                      contactShadow={{ scale: 5, blur: 2.2, far: 1.2 }}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <StepPlayer
                    steps={open.steps}
                    onSpeak={(txt) => {
                      /* wire TTS here if desired */
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-amber-100 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-neutral-600 md:flex-row">
          <div>
            © {new Date().getFullYear()} USVI Food — Three Little Birds
          </div>
        </div>
      </footer>
    </div>
  );
}
