import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Props = {
  autoRotate: boolean;
  onUnavailable: () => void;
};

function plushMaterial(color: string, roughness = 0.88) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, sheen: 0.35, sheenRoughness: 0.85 });
}

function addRoundedPart(
  root: THREE.Group,
  name: string,
  position: [number, number, number],
  scale: [number, number, number],
  color: string
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), plushMaterial(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function createBerneseConcept() {
  const root = new THREE.Group();
  root.name = "Bernese lying plush concept";
  const black = "#171615";
  const white = "#f6f1e8";
  const brown = "#a66135";

  addRoundedPart(root, "Main body", [0.35, 0.1, 0], [2.35, 0.92, 0.88], black);
  addRoundedPart(root, "Head", [-2.05, 0.15, 0], [1.04, 0.96, 0.9], black);
  addRoundedPart(root, "Muzzle", [-2.76, -0.16, 0.32], [0.56, 0.44, 0.43], white);
  addRoundedPart(root, "Nose", [-3.18, -0.05, 0.54], [0.18, 0.13, 0.12], "#101010");
  addRoundedPart(root, "White face blaze", [-2.34, 0.56, 0.67], [0.18, 0.54, 0.12], white);
  addRoundedPart(root, "Ear left", [-1.95, 0.45, 0.82], [0.46, 0.68, 0.27], black).rotation.x = -0.35;
  addRoundedPart(root, "Ear right", [-1.95, 0.45, -0.82], [0.46, 0.68, 0.27], black).rotation.x = 0.35;
  addRoundedPart(root, "Forepaw left", [-1.63, -0.68, 0.72], [0.58, 0.37, 0.45], white);
  addRoundedPart(root, "Forepaw right", [-1.63, -0.68, -0.72], [0.58, 0.37, 0.45], white);
  addRoundedPart(root, "Backpaw left", [1.92, -0.66, 0.72], [0.62, 0.38, 0.48], white);
  addRoundedPart(root, "Backpaw right", [1.92, -0.66, -0.72], [0.62, 0.38, 0.48], white);
  addRoundedPart(root, "Brown foreleg left", [-1.42, -0.4, 0.72], [0.4, 0.42, 0.38], brown);
  addRoundedPart(root, "Brown foreleg right", [-1.42, -0.4, -0.72], [0.4, 0.42, 0.38], brown);
  const tail = addRoundedPart(root, "Tail", [2.6, 0.45, -0.05], [0.75, 0.33, 0.32], black);
  tail.rotation.z = 0.32;

  const cord = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.024, 8, 28, Math.PI * 1.15),
    new THREE.MeshStandardMaterial({ color: "#254c35", roughness: 0.72 })
  );
  cord.position.set(-1.65, 0.38, 0.9);
  cord.rotation.x = Math.PI / 2;
  root.add(cord);
  const tag = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.64, 0.04),
    new THREE.MeshStandardMaterial({ color: "#f6f1e8", roughness: 0.74 })
  );
  tag.position.set(-1.48, -0.05, 1.03);
  tag.rotation.z = -0.25;
  root.add(tag);
  return root;
}

export function BerneseConceptPreview({ autoRotate, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      onUnavailable();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0.35, 2.2, 8.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.15, -0.05, 0);
    controls.enablePan = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.15;
    controls.minDistance = 5.6;
    controls.maxDistance = 11;
    const key = new THREE.DirectionalLight("#fff8e9", 2.3);
    key.position.set(-4, 7, 5);
    key.castShadow = true;
    const fill = new THREE.HemisphereLight("#f4f7ee", "#4f463e", 2.2);
    scene.add(key, fill, createBerneseConcept());
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(5.6, 48),
      new THREE.MeshStandardMaterial({ color: "#eef2e9", roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.08;
    ground.receiveShadow = true;
    scene.add(ground);
    let frame = 0;
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = Math.max(width / Math.max(height, 1), 0.1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const animate = () => {
      controls.autoRotate = autoRotate;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [autoRotate, onUnavailable]);

  return <div className="at-bernese-concept-canvas" ref={hostRef} aria-label="버니즈 기념 독 인형 3D 컨셉 프리뷰" />;
}
