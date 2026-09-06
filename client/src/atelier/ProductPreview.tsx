import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { productGeometry, partGeometry } from "./geometry";
import { outlines, type Project } from "./project";
import { materialAppearance, resolveTemplateParts, visualTemplateProfile } from "./productDefinition";
import { buildDesignProof, buildProofExportPlan } from "./designProof";
import type { ProtectedArtifact } from "./buyerAccess";

function createPlushTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#b77948";
  context.fillRect(0, 0, 512, 512);
  let seed = 2463534242;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let index = 0; index < 1800; index++) {
    const x = next() * 512;
    const y = next() * 512;
    const length = 2 + next() * 7;
    context.strokeStyle = next() > 0.5 ? "rgba(255,236,203,0.13)" : "rgba(78,42,23,0.12)";
    context.lineWidth = 0.45 + next() * 0.75;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y + (next() - 0.5) * 1.8);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.6, 2.6);
  return texture;
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type PreviewView = "front" | "side" | "back" | "free";

function previewDirection(view: PreviewView) {
  if (view === "side") return new THREE.Vector3(1, 0, 0);
  if (view === "back") return new THREE.Vector3(0, 0, -1);
  if (view === "free") return new THREE.Vector3(0.7, 0.3, 1).normalize();
  return new THREE.Vector3(0, 0, 1);
}

export function previewCameraDistance(
  size: THREE.Vector3,
  fov: number,
  aspect: number
) {
  const verticalHalfAngle = THREE.MathUtils.degToRad(fov / 2);
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * Math.max(aspect, 0.1));
  const verticalDistance = size.y / 2 / Math.tan(verticalHalfAngle);
  const horizontalDistance = size.x / 2 / Math.tan(horizontalHalfAngle);
  return Math.max(4, Math.max(verticalDistance, horizontalDistance) * 1.58 + size.z * 0.25);
}

function framePreview(
  engine: {
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    root?: THREE.Group;
  },
  view: PreviewView
) {
  if (!engine.root) return;
  const bounds = new THREE.Box3().setFromObject(engine.root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const distance = previewCameraDistance(size, engine.camera.fov, engine.camera.aspect);
  engine.camera.position.copy(center).add(previewDirection(view).multiplyScalar(distance));
  engine.camera.near = Math.max(0.1, distance / 100);
  engine.camera.far = Math.max(3000, distance * 20);
  engine.camera.updateProjectionMatrix();
  engine.controls.target.copy(center);
  engine.controls.update();
}
function dispose(root: THREE.Object3D) {
  root.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if ("map" in m) (m.map as THREE.Texture | null)?.dispose();
        m.dispose();
      });
    }
  });
}
function previewMaterial(color: string, materialName: string) {
  const base = materialAppearance(materialName);
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: base.roughness,
    metalness: base.metalness,
    clearcoat: materialName === "nylon" ? 0.12 : 0,
    clearcoatRoughness: materialName === "nylon" ? 0.38 : 0,
    sheen: materialName === "minky" || materialName === "velboa" ? 0.22 : 0,
    sheenRoughness: materialName === "minky" || materialName === "velboa" ? 0.75 : 1,
  });
}
function addBearConstructionOverlay(root: THREE.Group, project: Project) {
  if (project.templateId !== "bear") return;
  const z = project.depth / 2 + 0.14;
  const lineMaterial = new THREE.LineBasicMaterial({
    color: "#785c48",
    transparent: true,
    opacity: 0.55,
  });
  const center = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, project.height * 0.32, z),
    new THREE.Vector3(0, -project.height * 0.4, z),
  ]);
  const belly = new THREE.EllipseCurve(
    0,
    -project.height * 0.06,
    project.width * 0.23,
    project.height * 0.3,
    0,
    Math.PI * 2,
    false,
    0
  )
    .getPoints(36)
    .map(point => new THREE.Vector3(point.x, point.y, z));
  const group = new THREE.Group();
  group.name = "SEAM_center";
  group.add(new THREE.Line(center, lineMaterial));
  group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(belly), lineMaterial.clone()));
  root.add(group);
}
export function ProductPreview({
  project: p,
  onMessage,
  authenticated,
  onRequireAuthentication,
  onProtectedExport,
}: {
  project: Project;
  onMessage: (s: string) => void;
  authenticated: boolean;
  onRequireAuthentication: (artifact: ProtectedArtifact) => void;
  onProtectedExport: (artifact: Exclude<ProtectedArtifact, "클라우드 저장" | "제작 견적 요청" | "Design Proof PDF" | "Design Proof JSON">) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null),
    engine = useRef<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          controls: OrbitControls;
          renderer: THREE.WebGLRenderer;
          root?: THREE.Group;
        }
      | undefined
    >(undefined),
    [unsupported, setUnsupported] = useState(false),
    [error, setError] = useState(""),
    [view, setView] = useState<PreviewView>("front"),
    [exporting, setExporting] = useState(false),
    [texturesReady, setTexturesReady] = useState(true);
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setUnsupported(true);
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#edf1e7");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 3000);
    camera.position.set(0, 0, 150);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.current.replaceChildren(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight("#ffffff", "#9da99a", 3));
    const light = new THREE.DirectionalLight("#fff9ed", 3);
    light.position.set(-50, 100, 150);
    scene.add(light);
    engine.current = { scene, camera, renderer, controls };
      const resize = () => {
      const w = host.current?.clientWidth || 500,
        h = host.current?.clientHeight || 500;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (engine.current) framePreview(engine.current, view);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    resize();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      dispose(scene);
      renderer.dispose();
      engine.current = undefined;
    };
  }, []);
  useEffect(() => {
    const e = engine.current;
    let cancelled = false;
    setError("");
    try {
      const geometry = productGeometry(p);
      if (!e) {
        geometry.dispose();
        return;
      }
      if (e.root) {
        e.scene.remove(e.root);
        dispose(e.root);
      }
      const root = new THREE.Group();
      root.name = p.name;
      e.root = root;
      e.scene.add(root);
      const body = new THREE.Mesh(
        geometry,
        previewMaterial(p.color, p.materials.body)
      );
      body.name = "Main body";
      root.add(body);
      const groups = new Map<string, THREE.Group>();
      resolveTemplateParts({
        templateId: p.templateId!,
        parameters: p.parameters,
        parts: p.parts,
      }).forEach(part => {
        const mesh = new THREE.Mesh(
          partGeometry(part),
          previewMaterial(part.color, p.materials[part.materialSlot ?? "body"])
        );
        mesh.name = part.name;
        mesh.userData.partId = part.id;
        mesh.position.set(part.x, part.y, part.z);
        mesh.rotation.z = THREE.MathUtils.degToRad(part.rotation);
        if (part.group) {
          let g = groups.get(part.group);
          if (!g) {
            g = new THREE.Group();
            g.name = `Assembly ${part.group}`;
            groups.set(part.group, g);
            root.add(g);
          }
          g.add(mesh);
        } else root.add(mesh);
      });
      addBearConstructionOverlay(root, p);
      root.updateMatrixWorld(true);
      framePreview(e, view);
      const needsBearFabric = p.templateId === "bear";
      setTexturesReady(p.decals.length === 0 && !needsBearFabric);
      let pending = p.decals.length + (needsBearFabric ? 1 : 0);
      if (needsBearFabric) {
        const texture = createPlushTexture();
        const material = body.material;
        if (texture && material instanceof THREE.MeshPhysicalMaterial) {
          material.map = texture;
          material.needsUpdate = true;
        } else {
          onMessage("플러시 원단 질감을 만들지 못해 기본 재질로 표시합니다.");
        }
        if (--pending === 0) setTexturesReady(true);
      }
      p.decals.forEach(decal => {
        const asset = p.assets.find(a => a.id === decal.assetId);
        if (!asset?.data) {
          if (--pending === 0) setTexturesReady(true);
          return;
        }
        new THREE.TextureLoader().load(
          asset.data,
          texture => {
            if (cancelled) {
              texture.dispose();
              return;
            }
            texture.colorSpace = THREE.SRGBColorSpace;
            const image = texture.image,
              ratio = image.width / image.height;
            const back = decal.face === "back";
            const g = new DecalGeometry(
              body,
              new THREE.Vector3(
                decal.x,
                decal.y,
                back ? -p.depth / 2 : p.depth / 2
              ),
              new THREE.Euler(
                0,
                back ? Math.PI : 0,
                THREE.MathUtils.degToRad(decal.rotation)
              ),
              new THREE.Vector3(decal.size, decal.size / ratio, p.depth * 1.1)
            );
            const mesh = new THREE.Mesh(
              g,
              new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -4,
                roughness: 0.9,
              })
            );
            mesh.name = `Print ${decal.id}`;
            root.add(mesh);
            if (--pending === 0) setTexturesReady(true);
          },
          undefined,
          () => {
            if (!cancelled) {
              setError("디자인 이미지를 읽지 못했습니다. 다시 첨부해 주세요.");
              if (--pending === 0) setTexturesReady(true);
            }
          }
        );
      });
    } catch (err) {
      if (e?.root) {
        e.scene.remove(e.root);
        dispose(e.root);
        e.root = undefined;
      }
      setError(err instanceof Error ? err.message : "형상 생성 실패");
    }
    return () => {
      cancelled = true;
    };
  }, [p]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    framePreview(e, view);
  }, [view, p]);
  const png = async () => {
    if (!authenticated) {
      onRequireAuthentication("완성 미리보기 PNG");
      return;
    }
    try {
      if (engine.current && !unsupported) {
        engine.current.renderer.render(
          engine.current.scene,
          engine.current.camera
        );
        engine.current.renderer.domElement.toBlob(b => {
          if (!b) return;
          saveBlob(b, `${p.name}-preview.png`);
          onProtectedExport("완성 미리보기 PNG");
        });
        return;
      }
      if (!svg.current) return;
      const xml = new XMLSerializer().serializeToString(svg.current),
        url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const image = new Image();
          image.onload = () => res(image);
          image.onerror = rej;
          image.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = 1000;
        canvas.height = 1000;
        canvas.getContext("2d")!.drawImage(img, 0, 0, 1000, 1000);
        canvas.toBlob(b => {
          if (!b) return;
          saveBlob(b, `${p.name}-2D-preview.png`);
          onProtectedExport("완성 미리보기 PNG");
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      onMessage("이미지를 내보내지 못했습니다.");
    }
  };
  const glb = async () => {
    if (!authenticated) {
      onRequireAuthentication("부위 분리 GLB");
      return;
    }
    if (!engine.current?.root) return;
    setExporting(true);
    try {
      const root = engine.current.root.clone(true);
      root.scale.setScalar(0.01);
      root.userData = { unit: "meter", projectId: p.id, revision: p.revision };
      const result = await new GLTFExporter().parseAsync(root, {
        binary: true,
      });
      saveBlob(
        new Blob([result as ArrayBuffer], { type: "model/gltf-binary" }),
        `${p.name}.glb`
      );
      onProtectedExport("부위 분리 GLB");
    } catch {
      onMessage("3D 파일 내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };
  const proofViews = async () => {
    if (!authenticated) {
      onRequireAuthentication("Design Proof 3면 PNG");
      return;
    }
    const e = engine.current;
    if (!e || unsupported || !texturesReady) return;
    setExporting(true);
      const original = e.camera.position.clone();
      const originalTarget = e.controls.target.clone();
      try {
      const exportPlan = buildProofExportPlan(buildDesignProof(p));
      const views = ["front", "side", "back"] as const;
      for (let index = 0; index < views.length; index++) {
        const viewName = views[index]!;
        framePreview(e, viewName);
        e.renderer.render(e.scene, e.camera);
        const blob = await new Promise<Blob | null>(resolve =>
          e.renderer.domElement.toBlob(resolve, "image/png")
        );
        if (!blob) throw Error("이미지 출력을 만들지 못했습니다.");
        saveBlob(blob, exportPlan.files[index]!.filename);
      }
      onProtectedExport("Design Proof 3면 PNG");
      onMessage("Design Proof용 정면·옆면·뒷면 PNG 3장을 저장했습니다.");
    } catch {
      onMessage("Design Proof용 뷰 패키지를 내보내지 못했습니다.");
      } finally {
        e.camera.position.copy(original);
        e.controls.target.copy(originalTarget);
        e.controls.update();
      setExporting(false);
    }
  };
  const points =
    p.useOutline && p.front.length >= 3 ? p.front : outlines[p.product];
  const x0 = Math.min(...points.map(a => a[0])),
    x1 = Math.max(...points.map(a => a[0])),
    y0 = Math.min(...points.map(a => a[1])),
    y1 = Math.max(...points.map(a => a[1]));
  const scale = 330 / Math.max(p.width, p.height),
    w = p.width * scale,
    h = p.height * scale;
  const poly = points
    .map(
      a =>
        `${250 + ((a[0] - x0) / (x1 - x0) - 0.5) * w},${230 + ((a[1] - y0) / (y1 - y0) - 0.5) * h}`
    )
    .join(" ");
  return (
    <section className="at-preview">
      <div className="at-preview-label">
        {unsupported ? "2D 정면 미리보기" : visualTemplateProfile(p.templateId!).displayLabel}{" "}
        <span>
          {p.width} × {p.height} × {p.depth} cm
        </span>
      </div>
      <div ref={host} className="at-webgl" hidden={unsupported} />
      {unsupported && (
        <svg
          ref={svg}
          viewBox="0 0 500 500"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={`${p.name} 색상과 디자인 정면 미리보기`}
        >
          <defs>
            <clipPath id="product-clip">
              <polygon points={poly} />
            </clipPath>
          </defs>
          <rect width="500" height="500" fill="#edf1e7" />
          <ellipse cx="250" cy="433" rx="145" ry="15" fill="#0000000b" />
          <polygon
            points={poly}
            fill={p.color}
            stroke="#66755d"
            strokeWidth="1"
          />
          {p.parts.map(part => (
            <g
              key={part.id}
              transform={`translate(${250 + part.x * scale} ${230 - part.y * scale}) rotate(${-part.rotation})`}
            >
              {part.shape === "sphere" ? (
                <ellipse
                  rx={(part.width * scale) / 2}
                  ry={(part.height * scale) / 2}
                  fill={part.color}
                />
              ) : (
                <rect
                  x={(-part.width * scale) / 2}
                  y={(-part.height * scale) / 2}
                  width={part.width * scale}
                  height={part.height * scale}
                  rx="3"
                  fill={part.color}
                />
              )}
            </g>
          ))}
          <g clipPath="url(#product-clip)">
            {p.decals
              .filter(d => d.face === "front")
              .map(d => (
                <image
                  key={d.id}
                  href={p.assets.find(a => a.id === d.assetId)?.data}
                  x={250 + d.x * scale - (d.size * scale) / 2}
                  y={230 - d.y * scale - (d.size * scale) / 2}
                  width={d.size * scale}
                  height={d.size * scale}
                  transform={`rotate(${-d.rotation} ${250 + d.x * scale} ${230 - d.y * scale})`}
                />
              ))}
          </g>
          <text
            x="250"
            y="477"
            textAnchor="middle"
            fontSize="12"
            fill="#64775b"
          >
            2D FRONT · {p.width} × {p.height} cm
          </text>
        </svg>
      )}
      {error && (
        <p className="at-error" role="alert">
          {error}
        </p>
      )}
      {!unsupported && (
        <div className="at-view-buttons">
          {([
            ["front", "정면"],
            ["side", "옆면"],
            ["back", "뒷면"],
            ["free", "자유 회전"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <p className="at-preview-note at-preview-guidance">
        {unsupported
          ? "이 브라우저는 WebGL을 지원하지 않아 2D로 표시합니다. 3D 회전·GLB는 WebGL 지원 기기에서 이용하세요."
          : "드래그로 회전 · 스크롤로 확대. 원단 주름·봉제선은 재현하지 않는 형태 검토 모델입니다."}
      </p>
      <details className="at-preview-fidelity">
        <summary>현재 3D 표현 범위와 제작 검토 기준</summary>
        <p>{visualTemplateProfile(p.templateId!).description}</p>
      </details>
      <div className="at-view-buttons at-export-actions">
        <button onClick={png} disabled={!!error || !texturesReady}>
          완성 미리보기 PNG
        </button>
        <button onClick={proofViews} disabled={unsupported || !!error || !texturesReady || exporting}>
          Design Proof 3면 PNG
        </button>
        <button
          onClick={glb}
          disabled={unsupported || !!error || !texturesReady || exporting}
        >
          {exporting ? "내보내는 중…" : "부위 분리 GLB"}
        </button>
      </div>
    </section>
  );
}
