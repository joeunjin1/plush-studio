import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { Download, Rotate3D, TriangleAlert } from "lucide-react";
import { PlushIllustration } from "./PlushIllustration";
import type { DesignState } from "@/lib/studioTypes";

type Props = {
  design: DesignState;
  view: "perspective" | "front" | "side" | "back";
};

export function makeModel(design: DesignState) {
  const root = new THREE.Group();
  root.name = design.name;
  const plush = new THREE.MeshStandardMaterial({
    color: design.color,
    roughness: 0.88,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: design.accent,
    roughness: 0.92,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#28221E",
    roughness: 0.45,
  });
  const addBall = (
    name: string,
    position: [number, number, number],
    scale: [number, number, number],
    material = plush
  ) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), material);
    mesh.name = `${name}-${root.children.length + 1}`;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    root.add(mesh);
  };
  const body = design.bodyScale;
  const head = design.headScale;
  addBall("Body", [0, 1.75, 0], [0.82 * body, 1.05 * body, 0.64]);
  addBall("Belly", [0, 1.66, 0.53], [0.52 * body, 0.7 * body, 0.13], accent);
  addBall("Head", [0, 3.75, 0.03], [1.06 * head, 0.92 * head, 0.83 * head]);
  [-1, 1].forEach(side => {
    addBall("Arm", [side * 0.92 * body, 1.85, 0], [0.3, 0.67, 0.31]);
    addBall("Foot", [side * 0.46, 0.48, 0.2], [0.38, 0.46, 0.5]);
    addBall(
      "Ear",
      [side * 0.75 * head, 4.55, -0.04],
      [0.4 * head, 0.42 * design.earScale, 0.25 * head]
    );
    addBall(
      "Inner ear",
      [side * 0.75 * head, 4.56, 0.16],
      [0.24 * head, 0.26 * design.earScale, 0.07],
      accent
    );
    addBall("Eye", [side * 0.36 * head, 3.85, 0.77], [0.075, 0.09, 0.05], dark);
  });
  if (design.kind === "rabbit")
    root.children
      .filter(
        child =>
          child.name.startsWith("Ear-") || child.name.startsWith("Inner ear-")
      )
      .forEach(child => (child.scale.y *= 1.9));
  if (design.kind === "cat") {
    root.children
      .filter(
        child =>
          child.name.startsWith("Ear-") || child.name.startsWith("Inner ear-")
      )
      .forEach(child => {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        mesh.geometry = new THREE.ConeGeometry(1, 2, 3);
        mesh.rotation.y = Math.PI / 6;
      });
  }
  addBall("Muzzle", [0, 3.52, 0.8], [0.44 * head, 0.28 * head, 0.15], accent);
  addBall("Nose", [0, 3.65, 0.96], [0.1, 0.065, 0.045], dark);
  if (design.keyring) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.035, 12, 48),
      new THREE.MeshStandardMaterial({
        color: "#B9B6AE",
        metalness: 0.8,
        roughness: 0.22,
      })
    );
    ring.name = "Keyring";
    ring.position.set(0, 5.2, -0.18);
    root.add(ring);
  }
  const bounds = new THREE.Box3().setFromObject(root);
  const factor = 4.5 / (bounds.max.y - bounds.min.y);
  root.scale.setScalar(factor);
  root.position.y = -bounds.min.y * factor;
  return root;
}

export function ThreeDesigner({ design, view }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const hostElement = host.current;
    if (!hostElement) return;
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#EDF1E7");
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(6, 4.5, 10);
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      hostElement.replaceChildren(renderer.domElement);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.target.set(0, 2.2, 0);
      scene.add(new THREE.HemisphereLight("#FFFFFF", "#CFC3B5", 2.6));
      const key = new THREE.DirectionalLight("#FFF8EE", 3.5);
      key.position.set(-4, 7, 7);
      key.castShadow = true;
      scene.add(key);
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(6, 64),
        new THREE.MeshStandardMaterial({ color: "#E4EAD9", roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.03;
      ground.receiveShadow = true;
      scene.add(ground);
      sceneRef.current = scene;
      rendererRef.current = renderer;
      cameraRef.current = camera;
      controlsRef.current = controls;
      const resize = () => {
        const width = hostElement.clientWidth;
        const height = Math.max(1, hostElement.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(hostElement);
      resize();
      let frame = 0;
      const render = () => {
        frame = requestAnimationFrame(render);
        controls.update();
        renderer.render(scene, camera);
      };
      render();
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        disposeTree(scene);
        renderer.dispose();
        sceneRef.current = null;
        modelRef.current = null;
        controlsRef.current = null;
        cameraRef.current = null;
      };
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeTree(modelRef.current);
    }
    const model = makeModel(design);
    modelRef.current = model;
    scene.add(model);
  }, [design]);
  useEffect(() => {
    const camera = cameraRef.current,
      controls = controlsRef.current;
    if (!camera || !controls) return;
    const positions = {
      perspective: [6, 4.5, 10],
      front: [0, 2.2, 12],
      side: [12, 2.2, 0],
      back: [0, 2.2, -12],
    };
    camera.position.fromArray(positions[view]);
    controls.target.set(0, 2.2, 0);
    controls.update();
  }, [view]);
  const downloadGlb = async () => {
    if (!modelRef.current) return;
    const exporter = new GLTFExporter();
    const exported = modelRef.current.clone(true);
    const bounds = new THREE.Box3().setFromObject(exported);
    const factor = design.heightCm / 100 / (bounds.max.y - bounds.min.y);
    exported.scale.multiplyScalar(factor);
    exported.position.multiplyScalar(factor);
    const result = await exporter.parseAsync(exported, { binary: true });
    const url = URL.createObjectURL(
      new Blob([result as ArrayBuffer], { type: "model/gltf-binary" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${design.name || "plush"}.glb`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  if (error)
    return (
      <div className="three-fallback">
        <PlushIllustration design={design} />
        <p>2D 정면 미리보기 · 이 브라우저는 3D를 지원하지 않습니다.</p>
      </div>
    );
  return (
    <div className="three-shell">
      <div ref={host} className="three-canvas" />
      <div className="three-badge">
        <Rotate3D size={16} />
        LIVE 3D · {design.heightCm} cm
      </div>
      <button type="button" className="three-download" onClick={downloadGlb}>
        <Download size={16} /> GLB
      </button>
    </div>
  );
}

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(o => {
    if (o instanceof THREE.Mesh) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m =>
        materials.add(m)
      );
    }
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
}
