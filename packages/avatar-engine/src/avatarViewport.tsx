import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createAvatarRig, type AvatarRig } from './rig.js';
import type { PoseData } from './renderer.js';
import type { ViewportConfig } from './viewport.js';

export interface AvatarViewportProps extends ViewportConfig {
  pose?: PoseData | null;
  autoRotate?: boolean;
  showGrid?: boolean;
}

const FLOOR_SIZE = 12;

export function AvatarViewport({
  width = 960,
  height = 540,
  backgroundColor = '#020617',
  pose = null,
  autoRotate = true,
  showGrid = true
}: AvatarViewportProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<AvatarRig | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number>();
  const isInteractingRef = useRef(false);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3.5, 3.2, 6.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(6, 8, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
    fillLight.position.set(-4, 5, -6);
    scene.add(fillLight);

    if (showGrid) {
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(FLOOR_SIZE, 64),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.1, roughness: 0.85 })
      );
      floor.receiveShadow = true;
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const grid = new THREE.GridHelper(FLOOR_SIZE * 1.5, 32, 0x38bdf8, 0x1e293b);
      grid.position.y = 0.001;
      scene.add(grid);
    }

    const rig = createAvatarRig();
    rig.group.traverse(object => {
      object.castShadow = true;
      object.receiveShadow = true;
    });
    scene.add(rig.group);
    rigRef.current = rig;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = (3 * Math.PI) / 4;
    controls.target.copy(rig.pelvis.position);
    controls.update();
    controlsRef.current = controls;

    const onControlStart = () => {
      isInteractingRef.current = true;
    };
    const onControlEnd = () => {
      isInteractingRef.current = false;
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (autoRotate && !isInteractingRef.current) {
        rig.group.rotation.y += 0.0035;
      }
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();
      renderer.dispose();
      rigRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [autoRotate, backgroundColor, height, showGrid, width]);

  useEffect(() => {
    if (!pose) {
      rigRef.current?.applyPose(null);
      return;
    }

    rigRef.current?.applyPose(pose);
  }, [pose]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const mount = mountRef.current;
    const camera = cameraRef.current;
    if (!renderer || !mount || !camera) {
      return;
    }

    const handleResize = () => {
      if (!mount.parentElement) {
        return;
      }

      const bounds = mount.parentElement.getBoundingClientRect();
      const nextWidth = Math.min(width, bounds.width);
      const nextHeight = Math.round((nextWidth / width) * height);

      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [height, width]);

  return (
    <div
      ref={mountRef}
      className="avatar-viewport"
      style={{ width, height, borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 30px 80px rgba(15, 23, 42, 0.45)' }}
    />
  );
}
