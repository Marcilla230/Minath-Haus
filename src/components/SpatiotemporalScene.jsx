import { Billboard, Line, OrbitControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, Color, Object3D, Vector3 } from "three";

const NODE_COLORS = {
  idle: new Color("#67e8f9"),
  selected: new Color("#f8fafc"),
  related: new Color("#7dd3fc"),
  dimmed: new Color("#07111f"),
  hover: new Color("#e0f2fe"),
};

export default function SpatiotemporalScene({ nodes, selectedNode, onSelectNode, graph }) {
  return (
    <Canvas
      camera={{ position: [0, 42, 130], fov: 48, near: 0.1, far: 3000 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color args={["#020817"]} attach="background" />
      <fog args={["#020817", 120, 1650]} attach="fog" />
      <SceneContents
        graph={graph}
        nodes={nodes}
        onSelectNode={onSelectNode}
        selectedNode={selectedNode}
      />
    </Canvas>
  );
}

function SceneContents({ nodes, selectedNode, onSelectNode, graph }) {
  const controlsRef = useRef(null);

  return (
    <>
      <ambientLight intensity={0.38} />
      <pointLight color="#38bdf8" intensity={24} position={[22, 36, 42]} />
      <pointLight color="#1d4ed8" intensity={26} position={[-74, -18, -220]} />
      <pointLight color="#fbbf24" intensity={10} position={[50, 50, -540]} />

      <CameraFocus controlsRef={controlsRef} graph={graph} selectedNode={selectedNode} />
      <TimePlanes nodes={nodes} />
      <RelationLines edges={graph.edges} />
      <InstancedJinshiNodes
        graph={graph}
        nodes={nodes}
        onSelectNode={onSelectNode}
        selectedNode={selectedNode}
      />
      <ScholarLabels graph={graph} nodes={nodes} selectedNode={selectedNode} />

      <OrbitControls
        ref={controlsRef}
        dampingFactor={0.07}
        enableDamping
        maxDistance={900}
        minDistance={18}
        target={[0, 0, -330]}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.62} luminanceSmoothing={0.58} luminanceThreshold={0.12} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function CameraFocus({ controlsRef, selectedNode, graph }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!selectedNode) return;

    const focus = computeFocusBounds(selectedNode, graph.edges);
    const target = focus.center;
    const distance = Math.max(115, Math.min(760, focus.size * 1.55));
    const cameraTarget = {
      x: target.x + distance * 0.42,
      y: target.y + Math.max(46, distance * 0.32),
      z: target.z + distance,
    };

    gsap.to(camera.position, {
      ...cameraTarget,
      duration: 1.65,
      ease: "power3.inOut",
      onUpdate: () => camera.updateProjectionMatrix(),
    });

    if (controlsRef.current) {
      gsap.to(controlsRef.current.target, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 1.65,
        ease: "power3.inOut",
      });
    }
  }, [camera, controlsRef, graph.edges, selectedNode]);

  return null;
}

function InstancedJinshiNodes({ nodes, selectedNode, onSelectNode, graph }) {
  const meshRef = useRef(null);
  const hitMeshRef = useRef(null);
  const dummy = useMemo(() => new Object3D(), []);
  const [hoveredId, setHoveredId] = useState(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    nodes.forEach((node, index) => {
      const position = node.geography.position;
      const scale = selectedNode?.id === node.id ? 1.75 : graph.relatedIds.has(node.id) ? 1.28 : 0.82;
      dummy.position.set(position.x, position.y, position.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.matrix);
      meshRef.current.setColorAt(index, resolveNodeColor(node, selectedNode, graph, hoveredId));

      dummy.scale.setScalar(Math.max(2.8, scale * 2.2));
      dummy.updateMatrix();
      hitMeshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (hitMeshRef.current) {
      hitMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [dummy, graph, hoveredId, nodes, selectedNode]);

  if (nodes.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={meshRef} args={[null, null, nodes.length]}>
        <sphereGeometry args={[0.48, 14, 14]} />
        <meshStandardMaterial
          blending={AdditiveBlending}
          color="#67e8f9"
          emissive="#0ea5e9"
          emissiveIntensity={1.08}
          opacity={0.86}
          roughness={0.38}
          transparent
          vertexColors
        />
      </instancedMesh>

      <instancedMesh
        args={[null, null, nodes.length]}
        onClick={(event) => {
          event.stopPropagation();
          const node = nodes[event.instanceId];
          if (node) onSelectNode(node);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          const node = nodes[event.instanceId];
          setHoveredId(node?.id ?? null);
          document.body.style.cursor = node ? "pointer" : "default";
        }}
        onPointerOut={() => {
          setHoveredId(null);
          document.body.style.cursor = "default";
        }}
        ref={hitMeshRef}
      >
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </instancedMesh>
    </group>
  );
}

function ScholarLabels({ nodes, selectedNode, graph }) {
  const visibleNodes = useMemo(() => {
    if (graph.active) {
      return nodes.filter((node) => graph.relatedIds.has(node.id));
    }
    return selectedNode ? [selectedNode] : [];
  }, [graph.active, graph.relatedIds, nodes]);

  return (
    <>
      {visibleNodes.map((node) => {
        const position = node.geography.position;
        const isSelected = selectedNode?.id === node.id;
        const isDimmed = graph.active && !graph.relatedIds.has(node.id);
        return (
          <Billboard
            follow
            key={node.id}
            position={[position.x, position.y + (isSelected ? 3.2 : 2.3), position.z]}
          >
            <Text
              anchorX="center"
              anchorY="middle"
              color={isSelected ? "#f8fafc" : "#7dd3fc"}
              fontSize={isSelected ? 2.45 : 1.05}
              maxWidth={18}
              outlineColor="#09080b"
              outlineWidth={0.035}
              textAlign="center"
              fillOpacity={isDimmed ? 0.1 : isSelected ? 1 : 0.72}
            >
              {node.core.name}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}

function TimePlanes({ nodes }) {
  const planes = useMemo(() => {
    const groups = new Map();
    nodes.forEach((node) => {
      const reign = node.chronology.reignName;
      if (!reign) return;
      const current = groups.get(reign) ?? { reign, minZ: Infinity, maxZ: -Infinity, count: 0 };
      current.minZ = Math.min(current.minZ, node.chronology.z);
      current.maxZ = Math.max(current.maxZ, node.chronology.z);
      current.count += 1;
      groups.set(reign, current);
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        z: (group.minZ + group.maxZ) / 2,
      }))
      .sort((a, b) => b.z - a.z);
  }, [nodes]);

  return (
    <>
      {planes.map((plane) => (
        <group key={plane.reign} position={[0, 0, plane.z]}>
          <mesh rotation={[0, 0, 0]}>
            <planeGeometry args={[230, 150, 1, 1]} />
            <meshBasicMaterial color="#0ea5e9" opacity={0.038} transparent />
          </mesh>
          <gridHelper
            args={[230, 24, "#38bdf8", "#0f2a44"]}
            position={[0, 0, 0.08]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Billboard follow position={[-108, 68, 1.2]}>
            <Text
              anchorX="left"
              color="#7dd3fc"
              fontSize={4.6}
              outlineColor="#09080b"
              outlineWidth={0.05}
            >
              {plane.reign}朝
            </Text>
            <Text
              anchorX="left"
              color="#bfdbfe"
              fontSize={1.5}
              outlineColor="#09080b"
              outlineWidth={0.025}
              position={[0, -5.4, 0]}
            >
              {plane.count} 人
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
}

function RelationLines({ edges }) {
  useFrame(({ clock }) => {
    document.documentElement.style.setProperty(
      "--line-pulse",
      String((Math.sin(clock.elapsedTime * 3) + 1) / 2),
    );
  });

  return (
    <>
      {edges.map((edge) => (
        <FlowLine edge={edge} key={edge.id} />
      ))}
    </>
  );
}

function FlowLine({ edge }) {
  const points = useMemo(() => {
    const from = edge.from.geography.position;
    const to = edge.to.geography.position;
    const start = new Vector3(from.x, from.y, from.z);
    const end = new Vector3(to.x, to.y, to.z);
    const middle = start.clone().lerp(end, 0.5);
    middle.y += 12 + start.distanceTo(end) * 0.035;

    const result = [];
    for (let i = 0; i <= 32; i += 1) {
      const t = i / 32;
      const p1 = start.clone().lerp(middle, t);
      const p2 = middle.clone().lerp(end, t);
      result.push(p1.lerp(p2, t));
    }
    return result;
  }, [edge]);

  return (
    <Line
      blending={AdditiveBlending}
      color={edge.color}
      lineWidth={edge.type === "kinship" ? 2.8 : edge.type === "officePlace" ? 2.35 : 1.95}
      opacity={edge.type === "kinship" ? 0.84 : 0.68}
      points={points}
      transparent
    />
  );
}

function resolveNodeColor(node, selectedNode, graph, hoveredId) {
  if (hoveredId === node.id) return NODE_COLORS.hover;
  if (selectedNode?.id === node.id) return NODE_COLORS.selected;
  if (!graph.active) return NODE_COLORS.idle;
  if (!graph.relatedIds.has(node.id)) return NODE_COLORS.dimmed;

  const typedEdge = graph.edges.find(
    (edge) => edge.from.id === node.id || edge.to.id === node.id,
  );

  return typedEdge ? new Color(typedEdge.color) : NODE_COLORS.related;
}

function computeFocusBounds(selectedNode, edges) {
  const points = [selectedNode.geography.position];
  edges.forEach((edge) => {
    points.push(edge.from.geography.position, edge.to.geography.position);
  });

  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  points.forEach((point) => {
    min.min(new Vector3(point.x, point.y, point.z));
    max.max(new Vector3(point.x, point.y, point.z));
  });

  const center = min.clone().add(max).multiplyScalar(0.5);
  const size = Math.max(70, min.distanceTo(max));
  return { center, size };
}
