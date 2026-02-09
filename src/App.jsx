import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Text } from "@react-three/drei";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import WingMeshGlp from "./WingMesh";

const CFG = {
  gravity: -9.5,          
  flapVelocity: 3.6,      
  speed: 5.0,             
  gapSize: 1.35,          
  pipeHeight: 10.0,       
  pipeRadius: 0.25,
  laneX: 0.0,
  spawnZ: -22,
  resetZ: 2.0,
  spacing: 6.0,
  pipePairs: 7,
  playerRadius: 0.18,
  minY: -1.2,
  maxY: 2.4,

  
  shoulderOffset: 0.25,   
  upThreshold: 0.10,      
  downThreshold: 0.05,    
  gestureWindow: 0.65,    
  flapCooldown: 0.22,     
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function WingMesh({ side = "left" }) {
  
  return (
    <group
      scale={0.35}
      rotation={[0, side === "left" ? Math.PI / 2 : -Math.PI / 2, 0]}
      position={[side === "left" ? -0.03 : 0.03, 0.0, 0.02]}
    >
      <mesh>
        <planeGeometry args={[1.0, 0.5, 1, 1]} />
        <meshStandardMaterial color="#15151a" side={THREE.DoubleSide} />
      </mesh>

      {/* “عروق” بسيطة */}
      <mesh position={[0.15, 0.02, 0.001]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.9, 0.02, 0.01]} />
        <meshStandardMaterial color="#0d0d10" />
      </mesh>
      <mesh position={[0.05, -0.05, 0.001]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.7, 0.02, 0.01]} />
        <meshStandardMaterial color="#0d0d10" />
      </mesh>
    </group>
  );
}

function Pipe({ height = 8, radius = 0.25 }) {
  
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 24]} />
        <meshStandardMaterial color="#55d86a" />
      </mesh>
      <mesh position={[0, height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 1.15, radius * 0.18, 10, 30]} />
        <meshStandardMaterial color="#43c957" />
      </mesh>
    </group>
  );
}

function PipePair({ pipeHeight, pipeRadius, gapSize }) {
  const halfGap = gapSize / 2;
  const halfPipe = pipeHeight / 2;

  return (
    <>
      <group position={[0, -halfGap - halfPipe, 0]}>
        <Pipe height={pipeHeight} radius={pipeRadius} />
      </group>

      <group position={[0, +halfGap + halfPipe, 0]} rotation={[Math.PI, 0, 0]}>
        <Pipe height={pipeHeight} radius={pipeRadius} />
      </group>
    </>
  );
}


function XRInit({ controllersRef }) {
  const { gl } = useThree();

  useEffect(() => {
    gl.xr.enabled = true;

    const btn = VRButton.createButton(gl);
    btn.style.position = "absolute";
    btn.style.left = "20px";
    btn.style.bottom = "20px";
    document.body.appendChild(btn);

    return () => btn.remove();
  }, [gl]);

  const grips = useMemo(() => {
    
    const grip0 = gl.xr.getControllerGrip(0);
    const grip1 = gl.xr.getControllerGrip(1);
    const ctrl0 = gl.xr.getController(0);
    const ctrl1 = gl.xr.getController(1);
    return { grip0, grip1, ctrl0, ctrl1 };
  }, [gl]);

  useEffect(() => {
    controllersRef.current = grips;
  }, [grips, controllersRef]);

  
  return (
    <>
      <primitive object={grips.grip0}>
        <WingMeshGlp side="left" />
      </primitive>
      <primitive object={grips.grip1}>
        <WingMeshGlp side="right" />
      </primitive>
    </>
  );
}

function Game({ controllersRef }) {
  const worldRef = useRef();
  const pipesRef = useRef([]);

  const aliveRef = useRef(true);
  const yRef = useRef(0.8);
  const vyRef = useRef(0.0);

  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);

  
  const pipes = useRef(
    new Array(CFG.pipePairs).fill(0).map((_, i) => ({
      z: CFG.spawnZ - i * CFG.spacing,
      gapY: rand(-0.2, 1.4),
      passed: false,
    }))
  );

  const resetGame = useCallback(() => {
    aliveRef.current = true;
    setAlive(true);
    setScore(0);

    yRef.current = 0.8;
    vyRef.current = 0.0;

    pipes.current.forEach((p, i) => {
      p.z = CFG.spawnZ - i * CFG.spacing;
      p.gapY = rand(-0.2, 1.4);
      p.passed = false;
    });
  }, []);

  const flap = useCallback(() => {
    if (!aliveRef.current) return;
    vyRef.current = CFG.flapVelocity;
  }, []);

  
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") flap();
      if (e.code === "KeyR") resetGame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap, resetGame]);

  
  const gesture = useRef({
    left: { state: "idle", t0: 0, lastFlap: -999 },
    right: { state: "idle", t0: 0, lastFlap: -999 },
  });
  useEffect(() => {
    const ctrls = controllersRef.current;
    if (!ctrls) return;

    const onAnyButton = () => {
      if (!aliveRef.current) {
        resetGame();
      }
    };

    ctrls.ctrl0?.addEventListener("selectstart", onAnyButton);
    ctrls.ctrl1?.addEventListener("selectstart", onAnyButton);

    ctrls.ctrl0?.addEventListener("squeezestart", onAnyButton);
    ctrls.ctrl1?.addEventListener("squeezestart", onAnyButton);

    return () => {
      ctrls.ctrl0?.removeEventListener("selectstart", onAnyButton);
      ctrls.ctrl1?.removeEventListener("selectstart", onAnyButton);
      ctrls.ctrl0?.removeEventListener("squeezestart", onAnyButton);
      ctrls.ctrl1?.removeEventListener("squeezestart", onAnyButton);
    };
  }, [resetGame]);

  const tmpHead = useMemo(() => new THREE.Vector3(), []);
  const tmpL = useMemo(() => new THREE.Vector3(), []);
  const tmpR = useMemo(() => new THREE.Vector3(), []);

  function updateGesture(now, headY, leftY, rightY) {
    const shoulderY = headY - CFG.shoulderOffset;

    const step = (handKey, y) => {
      const g = gesture.current[handKey];

      if (now - g.lastFlap < CFG.flapCooldown) return;

      if (g.state === "idle") {
        if (y > shoulderY + CFG.upThreshold) {
          g.state = "up";
          g.t0 = now;
        }
        return;
      }

      if (g.state === "up") {
        if (now - g.t0 > CFG.gestureWindow) {
          g.state = "idle";
          return;
        }
        if (y < shoulderY - CFG.downThreshold) {
          g.lastFlap = now;
          g.state = "idle";
          flap();
        }
      }
    };

    if (Number.isFinite(leftY)) step("left", leftY);
    if (Number.isFinite(rightY)) step("right", rightY);
  }

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime;

    
    if (!aliveRef.current) {
      if (worldRef.current) worldRef.current.position.y = -yRef.current;
      return;
    }

    
    vyRef.current += CFG.gravity * dt;
    yRef.current += vyRef.current * dt;

    
    if (yRef.current < CFG.minY || yRef.current > CFG.maxY) {
      aliveRef.current = false;
      setAlive(false);
    }

    
    state.camera.getWorldPosition(tmpHead);

    const grips = controllersRef.current;
    let leftY = NaN;
    let rightY = NaN;

    if (grips?.grip0) {
      grips.grip0.getWorldPosition(tmpL);
      leftY = tmpL.y;
    }
    if (grips?.grip1) {
      grips.grip1.getWorldPosition(tmpR);
      rightY = tmpR.y;
    }

    updateGesture(now, tmpHead.y, leftY, rightY);

    
    if (worldRef.current) worldRef.current.position.y = -yRef.current;

    
    const halfGap = CFG.gapSize / 2;
    const safeTop = (gapY) => gapY + halfGap - CFG.playerRadius;
    const safeBottom = (gapY) => gapY - halfGap + CFG.playerRadius;

    for (let i = 0; i < pipes.current.length; i++) {
      const p = pipes.current[i];
      const mesh = pipesRef.current[i];
      if (!mesh) continue;

      
      p.z += CFG.speed * dt;
      mesh.position.z = p.z;

      
      if (!p.passed && p.z > 0) {
        p.passed = true;
        setScore(s => s + 1);
      }

      
      if (p.z > CFG.resetZ) {
        p.z = CFG.spawnZ;
        p.gapY = rand(-0.2, 1.4);
        p.passed = false;

        mesh.position.z = p.z;
        mesh.position.y = p.gapY;
      }

      
      if (p.z > -0.35 && p.z < 0.35) {
        const y = yRef.current;
        const halfGap = CFG.gapSize / 2;
        const top = p.gapY + halfGap - CFG.playerRadius;
        const bottom = p.gapY - halfGap + CFG.playerRadius;

        if (y > top || y < bottom) {
          aliveRef.current = false;
          setAlive(false);
        }
      }
    }

  });

  return (
    <>
      <Text
        position={[0, 1.8, -2.2]}
        fontSize={0.18}
        anchorX="center"
        anchorY="middle"
      >
        {alive
          ? `Score: ${score}`
          : `Game Over | Score: ${score} | Press any button`}

      </Text>

      {/* World (pipes live here) */}
      <group ref={worldRef}>
        {pipes.current.map((p, i) => (
          <group
            key={i}
            ref={el => (pipesRef.current[i] = el)}
            position={[CFG.laneX, p.gapY, p.z]}
          >
            <PipePair
              pipeHeight={CFG.pipeHeight}
              pipeRadius={CFG.pipeRadius}
              gapSize={CFG.gapSize}
            />
          </group>
        ))}



        <mesh position={[0, -1.35, -8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 60]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      </group>

      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 6, 2]} intensity={1.2} />
      <Environment
        files="/citrus_orchard_road_puresky_1k.exr"
        background
        blur={0.25}
      />

    </>
  );
}

export default function App() {
  const controllersRef = useRef(null);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#111" }}>
      <Canvas
        camera={{ position: [0, 1.6, 1.6], fov: 65 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
        }}
      >
        <XRInit controllersRef={controllersRef} />
        <Game controllersRef={controllersRef} />
      </Canvas>
    </div>
  );
}
