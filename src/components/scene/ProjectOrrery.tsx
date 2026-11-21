import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EXTENT, REVOLUTION_S, RING_RADII, SQUASH, TILT, type OrreryLayout } from './layout';

export interface ProjectOrreryProps {
  layout: OrreryLayout;
  /** False when off-screen, tab hidden, motion off, or printing: the loop stops. */
  running: boolean;
  /** Repo highlighted from the text list. */
  activeName: string | null;
  onHover: (name: string | null) => void;
  onSelect: (name: string) => void;
}

/** Weak bloom: an additive halo at this opacity, nothing stacked on top. */
const BLOOM = 0.25;

let haloTexture: THREE.CanvasTexture | null = null;
function getHalo(): THREE.CanvasTexture {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  haloTexture = new THREE.CanvasTexture(c);
  return haloTexture;
}

/** Sphere with a soft white-green rim: not a neon bulb. */
const RIM_VERTEX = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const RIM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRim;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.4);
    vec3 base = uColor * (0.5 + 0.35 * clamp(dot(normalize(vN), normalize(vec3(-0.4, 0.6, 0.7))), 0.0, 1.0));
    gl_FragColor = vec4(mix(base, uRim, f * 0.85), 1.0);
    #include <colorspace_fragment>
  }
`;

function Rim({ color, radius }: { color: string; radius: number }) {
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color('#DDEFE3') } }),
    [color],
  );
  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 32]} />
      <shaderMaterial vertexShader={RIM_VERTEX} fragmentShader={RIM_FRAGMENT} uniforms={uniforms} />
    </mesh>
  );
}

function Halo({ color, radius, opacity }: { color: string; radius: number; opacity: number }) {
  const map = useMemo(() => getHalo(), []);
  return (
    <sprite scale={[radius * 5, radius * 5, 1]}>
      <spriteMaterial map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function Ring({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#F3F0EA" transparent opacity={0.16} />
    </line>
  );
}

function Body({
  body,
  active,
  onHover,
  onSelect,
}: {
  body: OrreryLayout['bodies'][number];
  active: boolean;
  onHover: (name: string | null) => void;
  onSelect: (name: string) => void;
}) {
  const { gl, invalidate } = useThree();
  const group = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  const scale = useRef(1);
  const x = Math.cos(body.angle) * body.orbit;
  const y = Math.sin(body.angle) * body.orbit;

  useEffect(() => {
    invalidate();
  }, [active, invalidate]);
  useEffect(
    () => () => {
      gl.domElement.style.cursor = '';
    },
    [gl],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const target = hovered.current || active ? 1.3 : 1;
    scale.current += (target - scale.current) * 0.2;
    g.scale.setScalar(scale.current);
    // Under frameloop="demand" keep drawing until the hover ease settles.
    if (Math.abs(target - scale.current) > 0.01) invalidate();
  });

  return (
    <group ref={group} position={[x, y, 0]}>
      <mesh>
        <sphereGeometry args={[body.radius, 32, 24]} />
        <meshBasicMaterial color={body.color} />
      </mesh>
      <Halo color={body.color} radius={body.radius} opacity={active ? BLOOM * 0.9 : BLOOM * 0.4} />
      {/* Generous invisible hit target; the text list under the scene does the same job. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          hovered.current = true;
          gl.domElement.style.cursor = 'pointer';
          onHover(body.name);
          invalidate();
        }}
        onPointerOut={() => {
          hovered.current = false;
          gl.domElement.style.cursor = '';
          onHover(null);
          invalidate();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(body.name);
        }}
      >
        <sphereGeometry args={[Math.max(body.radius * 2.2, 0.32), 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Scene({ layout, running, activeName, onHover, onSelect }: ProjectOrreryProps) {
  const drift = useRef<THREE.Group>(null);
  const { size, camera, invalidate } = useThree();

  // Fit all rings (tilted) inside the canvas.
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    const zoom = Math.min(size.width / (2 * EXTENT), size.height / (2 * EXTENT * Math.max(0.5, SQUASH) + 0.6));
    cam.zoom = Math.max(8, zoom);
    cam.updateProjectionMatrix();
    invalidate();
  }, [size.width, size.height, camera, invalidate]);

  useFrame((_, delta) => {
    const g = drift.current;
    if (g && running) g.rotation.z += (Math.min(delta, 0.05) * Math.PI * 2) / REVOLUTION_S;
  });

  return (
    <group rotation={[-TILT, 0, 0]}>
      {RING_RADII.map((r) => (
        <Ring key={r} radius={r} />
      ))}
      <group ref={drift}>
        {layout.bodies.map((b) => (
          <Body key={b.name} body={b} active={activeName === b.name} onHover={onHover} onSelect={onSelect} />
        ))}
      </group>
      <Rim color={layout.center.color} radius={layout.center.radius} />
      <Halo color="#DDEFE3" radius={layout.center.radius} opacity={BLOOM} />
    </group>
  );
}

/** Lazy-loaded repo orrery. DPR capped at 1.5; the loop is driven by `running`. */
export default function ProjectOrrery(props: ProjectOrreryProps) {
  return (
    <Canvas
      orthographic
      dpr={[1, 1.5]}
      frameloop={props.running ? 'always' : 'demand'}
      camera={{ position: [0, 0, 20], zoom: 40, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      // Vertical swipes over the canvas must keep scrolling the page.
      style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
