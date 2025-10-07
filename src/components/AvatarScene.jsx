import { Suspense, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { useAvatarStore } from '../state/avatarStore.js';

const Body = ({ skinTone, accent }) => {
  const group = useRef();
  const breathing = useRef(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    breathing.current += delta;
    const scale = 1 + Math.sin(breathing.current) * 0.01;
    if (group.current) {
      group.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 24]} />
        <meshStandardMaterial color={skinTone} />
      </mesh>
      <mesh castShadow position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={skinTone} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0.35]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh castShadow position={[0, 1.05, -0.35]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial color={accent} roughness={0.35} metalness={0.65} />
      </mesh>
    </group>
  );
};

Body.propTypes = {
  skinTone: PropTypes.string.isRequired,
  accent: PropTypes.string.isRequired,
};

const FloatingAccessory = ({ color }) => {
  const meshRef = useRef();
  const speed = useMemo(() => 0.5 + Math.random() * 0.5, []);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const y = Math.sin(t * speed + offset) * 0.2 + 1.6;
    const x = Math.cos(t * speed + offset) * 0.6;
    const z = Math.sin(t * speed * 0.6 + offset) * 0.6;
    if (meshRef.current) {
      meshRef.current.position.set(x, y, z);
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <torusKnotGeometry args={[0.15, 0.05, 80, 16]} />
      <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
    </mesh>
  );
};

FloatingAccessory.propTypes = {
  color: PropTypes.string.isRequired,
};

const Avatar = () => {
  const { skinTone, accent, accessory } = useAvatarStore();

  return (
    <group>
      <Body skinTone={skinTone} accent={accent} />
      <FloatingAccessory color={accessory} />
    </group>
  );
};

const SceneLights = () => {
  const { keyLight, fillLight, rimLight } = useAvatarStore();

  return (
    <>
      <ambientLight intensity={0.4} />
      <spotLight
        castShadow
        position={[5, 6, 5]}
        angle={0.45}
        intensity={keyLight}
        penumbra={0.4}
      />
      <pointLight position={[-4, 3, -2]} intensity={fillLight} color="#a8d0ff" />
      <directionalLight position={[0, 4, -6]} intensity={rimLight} color="#ffffff" />
    </>
  );
};

const AvatarScene = () => {
  const { environment } = useAvatarStore();

  return (
    <Canvas camera={{ position: [3, 2, 6], fov: 50 }} shadows>
      <Suspense fallback={null}>
        <color attach="background" args={[environment.background]} />
        <Avatar />
        <SceneLights />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
          <circleGeometry args={[6, 64]} />
          <shadowMaterial transparent opacity={0.3} />
        </mesh>
        <Environment preset={environment.preset} background={false} />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={8} />
      </Suspense>
    </Canvas>
  );
};

export default AvatarScene;
