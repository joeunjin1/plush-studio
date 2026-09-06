import type { Point } from "./project";
/** Largest foreground outline for transparent or nearly uniform-background references. */
export function extractOutlinePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Point[] {
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    (height * width - 1) * 4,
  ];
  const bg = [0, 1, 2].map(
    c => corners.reduce((s, i) => s + data[i + c], 0) / 4
  );
  const transparent = corners.every(i => data[i + 3] < 40);
  if (
    !transparent &&
    corners.some(i => bg.some((v, c) => Math.abs(v - data[i + c]) > 35))
  )
    throw Error(
      "배경이 복잡합니다. 배경 없는 PNG를 사용하거나 직접 윤곽을 그려 주세요."
    );
  const mask = new Uint8Array(width * height),
    seen = new Uint8Array(mask.length);
  for (let n = 0; n < mask.length; n++) {
    const i = n * 4;
    mask[n] =
      data[i + 3] > 50 &&
      (transparent ||
        Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) >
          48)
        ? 1
        : 0;
  }
  let largest: number[] = [];
  for (let n = 0; n < mask.length; n++) {
    if (!mask[n] || seen[n]) continue;
    const queue = [n];
    seen[n] = 1;
    for (let k = 0; k < queue.length; k++) {
      const v = queue[k],
        x = v % width,
        y = Math.floor(v / width);
      for (const next of [
        x > 0 ? v - 1 : -1,
        x < width - 1 ? v + 1 : -1,
        y > 0 ? v - width : -1,
        y < height - 1 ? v + width : -1,
      ])
        if (next >= 0 && mask[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
    }
    if (queue.length > largest.length) largest = queue;
  }
  if (largest.length < width * height * 0.01)
    throw Error(
      "윤곽을 찾지 못했습니다. 배경과 제품의 색 차이를 확인해 주세요."
    );
  const component = new Set(largest),
    edges = new Map<string, Array<[number, number]>>();
  const add = (x: number, y: number, a: number, b: number) => {
    const key = `${x},${y}`;
    edges.set(key, [...(edges.get(key) || []), [a, b]]);
  };
  for (const n of largest) {
    const x = n % width,
      y = Math.floor(n / width);
    if (y === 0 || !component.has(n - width)) add(x, y, x + 1, y);
    if (x === width - 1 || !component.has(n + 1)) add(x + 1, y, x + 1, y + 1);
    if (y === height - 1 || !component.has(n + width))
      add(x + 1, y + 1, x, y + 1);
    if (x === 0 || !component.has(n - 1)) add(x, y + 1, x, y);
  }
  const loops: Point[][] = [];
  while (edges.size) {
    const start = edges.keys().next().value!;
    let key = start;
    const loop: Point[] = [];
    for (let i = 0; i < width * height * 4; i++) {
      const [x, y] = key.split(",").map(Number);
      loop.push([x / width, y / height]);
      const options = edges.get(key);
      if (!options?.length) break;
      const next = options.pop()!;
      if (!options.length) edges.delete(key);
      key = next.join(",");
      if (key === start) break;
    }
    if (loop.length > 3) loops.push(loop);
  }
  const area = (p: Point[]) =>
    Math.abs(
      p.reduce((s, a, i) => {
        const b = p[(i + 1) % p.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0)
    );
  loops.sort((a, b) => area(b) - area(a));
  const loop = loops[0];
  if (!loop) throw Error("윤곽을 찾지 못했습니다.");
  // Remove collinear pixels, then bound complexity for interactive editing.
  const simple = loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length],
      b = loop[(i + 1) % loop.length];
    return (
      Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) >
      1e-10
    );
  });
  const stride = Math.max(1, Math.ceil(simple.length / 100));
  return simple.filter((_, i) => i % stride === 0);
}
export async function extractOutline(dataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0, 256, 256);
  return extractOutlinePixels(
    context.getImageData(0, 0, 256, 256).data,
    256,
    256
  );
}
