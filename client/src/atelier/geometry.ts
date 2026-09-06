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
  const g =
    p.shape === "box"
      ? new THREE.BoxGeometry(p.width, p.height, p.depth)
      : new THREE.SphereGeometry(1, 32, 24);
  if (p.shape === "sphere") g.scale(p.width / 2, p.height / 2, p.depth / 2);
  return g;
}
