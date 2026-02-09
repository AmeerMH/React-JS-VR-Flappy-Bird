import { useGLTF } from "@react-three/drei";

export default function WingMeshGlp({ side="left" }) {
  const { scene } = useGLTF(side === "left" ? "/wing.glb" : "/wing-right.glb");
  return (
    <group
      scale={0.2}
    >
      <primitive object={scene.clone()} />
    </group>
  );
}
