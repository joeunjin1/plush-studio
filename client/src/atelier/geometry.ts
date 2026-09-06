import * as THREE from "three";
import {
  validateOutline,
  outlines,
  type Project,
  type Point,
  type Part,
} from "./project";
function span(points: Point[], y: number) {
  const xs: number[] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y))
      xs.push(p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
  });
  xs.sort((a, b) => a - b);
  if (xs.length !== 2)
    throw Error(
      "갈라진 윤곽은 부위별로 나눠 주세요. 정면·옆면은 높이마다 하나의 폭이어야 합니다."
    );
  return xs;
}

function roundedPanelGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corner = Math.max(
    0.1,
    Math.min(radius, halfWidth * 0.42, halfHeight * 0.42)
  );
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + corner);
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
  shape.lineTo(-halfWidth + corner, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - corner);
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + corner, -halfHeight);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: Math.min(corner * 0.28, depth * 0.22),
    bevelThickness: Math.min(corner * 0.2, depth * 0.16),
    bevelSegments: 4,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return fitGeometryToBounds(geometry, width, height, depth);
}

function fitGeometryToBounds(
  geometry: THREE.BufferGeometry,
  width: number,
  height: number,
  depth: number
) {
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  geometry.scale(width / size.x, height / size.y, depth / size.z);
  geometry.computeBoundingBox();
  return geometry;
}

function shirtBodyGeometry(width: number, height: number, depth: number) {
  const bodyWidth = width * 0.58;
  const sleeveReach = width * 0.49;
  const shoulderY = height * 0.42;
  const underarmY = height * 0.1;
  const hemY = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-bodyWidth / 2, hemY);
  shape.lineTo(bodyWidth / 2, hemY);
  shape.lineTo(bodyWidth / 2, underarmY);
  shape.lineTo(sleeveReach, height * 0.22);
  shape.quadraticCurveTo(
    sleeveReach + width * 0.025,
    height * 0.29,
    sleeveReach - width * 0.045,
    shoulderY
  );
  shape.lineTo(width * 0.2, height / 2);
  shape.quadraticCurveTo(width * 0.075, height * 0.39, 0, height * 0.39);
  shape.quadraticCurveTo(-width * 0.075, height * 0.39, -width * 0.2, height / 2);
  shape.lineTo(-sleeveReach + width * 0.045, shoulderY);
  shape.quadraticCurveTo(
    -sleeveReach - width * 0.025,
    height * 0.29,
    -sleeveReach,
    height * 0.22
  );
  shape.lineTo(-bodyWidth / 2, underarmY);
  shape.closePath();
  const thickness = Math.max(depth, 0.55);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: Math.min(width * 0.012, 0.8),
    bevelThickness: Math.min(depth * 0.2, 0.32),
    bevelSegments: 3,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.computeVertexNormals();
  return fitGeometryToBounds(geometry, width, height, depth);
}

export function shapeGeometry(
  front: Point[],
  side: Point[],
  width: number,
  height: number,
  depth: number
) {
  validateOutline(front);
  const minX = Math.min(...front.map(p => p[0])),
    maxX = Math.max(...front.map(p => p[0])),
    minY = Math.min(...front.map(p => p[1])),
    maxY = Math.max(...front.map(p => p[1]));
  let geometry: THREE.BufferGeometry;
  if (side.length >= 3) {
    validateOutline(side);
    const sy0 = Math.min(...side.map(p => p[1])),
      sy1 = Math.max(...side.map(p => p[1]));
    const sx0 = Math.min(...side.map(p => p[0])),
      sx1 = Math.max(...side.map(p => p[0]));
    const v: number[] = [],
      idx: number[] = [],
      rows = 32,
      n = 48;
    for (let i = 0; i <= rows; i++) {
      const t = 0.001 + (0.998 * i) / rows,
        fs = span(front, minY + t * (maxY - minY)),
        ss = span(side, sy0 + t * (sy1 - sy0));
      for (let j = 0; j < n; j++) {
        const angle = (j / n) * Math.PI * 2;
        v.push(
          (((fs[0] + fs[1]) / 2 - minX) / (maxX - minX) - 0.5) * width +
            (((Math.cos(angle) * (fs[1] - fs[0])) / (maxX - minX)) * width) / 2,
          (0.5 - t) * height,
          (((ss[0] + ss[1]) / 2 - sx0) / (sx1 - sx0) - 0.5) * depth +
            (((Math.sin(angle) * (ss[1] - ss[0])) / (sx1 - sx0)) * depth) / 2
        );
      }
    }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < n; j++) {
        const a = i * n + j,
          b = i * n + ((j + 1) % n),
          c = (i + 1) * n + j,
          d = (i + 1) * n + ((j + 1) % n);
        idx.push(a, b, c, b, d, c);
      }
    // Fan caps use ring centers rather than assuming symmetric silhouettes.
    for (const [ring, top] of [
      [0, true],
      [rows, false],
    ] as const) {
      const center = new THREE.Vector3();
      for (let j = 0; j < n; j++)
        center.add(new THREE.Vector3().fromArray(v, (ring * n + j) * 3));
      center.divideScalar(n);
      const ci = v.length / 3;
      v.push(...center.toArray());
      for (let j = 0; j < n; j++) {
        const a = ring * n + j,
          b = ring * n + ((j + 1) % n);
        idx.push(ci, top ? b : a, top ? a : b);
      }
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    geometry.setIndex(idx);
    geometry.computeVertexNormals();
  } else {
    const shape = new THREE.Shape();
    front.forEach((p, i) => {
      const x = ((p[0] - minX) / (maxX - minX) - 0.5) * width,
        y = (0.5 - (p[1] - minY) / (maxY - minY)) * height;
      i ? shape.lineTo(x, y) : shape.moveTo(x, y);
    });
    shape.closePath();
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
  }
  geometry.computeBoundingBox();
  return geometry;
}
export function productGeometry(p: Project) {
  if (p.templateId === "bear") {
    const geometry = new THREE.SphereGeometry(1, 64, 48);
    geometry.scale(p.width * 0.36, p.height * 0.5, p.depth * 0.46);
    geometry.translate(0, p.height * 0.01, 0);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  }
  if (p.templateId === "rabbit" || p.templateId === "cat" || p.templateId === "keyring") {
    const geometry = new THREE.SphereGeometry(1, 48, 36);
    const verticalScale = p.templateId === "rabbit" ? 0.32 : p.templateId === "cat" ? 0.44 : 0.35;
    geometry.scale(p.width * 0.36, p.height * verticalScale, p.depth * 0.46);
    geometry.translate(0, -p.height * 0.09, 0);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  }
  if (p.templateId === "cushion") {
    return roundedPanelGeometry(
      p.width,
      p.height,
      p.depth,
      Math.min(p.width, p.height) * 0.18
    );
  }
  if (p.product === "bag") {
    return roundedPanelGeometry(
      p.width,
      p.height,
      p.depth,
      Math.min(p.width, p.height) * 0.08
    );
  }
  if (p.product === "shirt") return shirtBodyGeometry(p.width, p.height, p.depth);
  return shapeGeometry(
    p.useOutline ? p.front : outlines[p.product],
    p.useOutline
      ? p.side
      : p.product === "plush"
        ? [
            [0.5, 0],
            [0.9, 0.2],
            [0.8, 0.55],
            [0.9, 0.8],
            [0.5, 1],
            [0.1, 0.8],
            [0.2, 0.55],
            [0.1, 0.2],
          ]
        : [],
    p.width,
    p.height,
    p.depth
  );
}
export function partGeometry(p: Part) {
  if (p.shape === "outline")
    return shapeGeometry(p.front, p.side, p.width, p.height, p.depth);
  if (
    p.kind === "zipper" ||
    p.kind === "pocket" ||
    p.kind === "front-pocket" ||
    p.kind === "flap"
  ) {
    return roundedPanelGeometry(
      p.width,
      p.height,
      p.depth,
      Math.min(p.width, p.height) * 0.14
    );
  }
  if (p.kind === "sleeve-left" || p.kind === "sleeve-right") {
    return roundedPanelGeometry(
      p.width,
      p.height,
      Math.max(p.depth, 0.6),
      p.width * 0.2
    );
  }
  const g = p.shape === "box"
    ? new THREE.BoxGeometry(p.width, p.height, p.depth)
    : p.shape === "cylinder"
      ? new THREE.CylinderGeometry(p.width / 2, p.width / 2, p.height, 24)
      : p.shape === "torus"
        ? new THREE.TorusGeometry(Math.max(p.width, p.height) / 2.8, Math.max(p.depth, 0.45) / 2, 12, 36)
        : p.shape === "capsule"
          ? new THREE.CapsuleGeometry(Math.max(p.width, p.depth) / 2, Math.max(0.1, p.height - Math.max(p.width, p.depth)), 12, 24)
          : new THREE.SphereGeometry(1, 32, 24);
  if (p.shape === "sphere") g.scale(p.width / 2, p.height / 2, p.depth / 2);
  if (p.shape === "torus") g.scale(1, p.height / Math.max(p.width, p.height), 1);
  if (p.shape === "capsule") g.scale(1, 1, p.depth / Math.max(p.width, p.depth));
  return g;
}
