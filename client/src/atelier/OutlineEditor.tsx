import type { Point } from "./project";
export function OutlineEditor({
  image,
  points,
  onChange,
  label,
}: {
  image?: string;
  points: Point[];
  onChange: (p: Point[]) => void;
  label: string;
}) {
  return (
    <div className="at-outline">
      <p>{label} · 테두리를 순서대로 눌러 닫힌 윤곽을 만드세요.</p>
      <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label={`${label} 윤곽 편집`}
        onPointerDown={e => {
          if (points.length >= 128) return;
          const r = e.currentTarget.getBoundingClientRect();
          onChange([
            ...points,
            [
              Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
              Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
            ],
          ]);
        }}
      >
        <rect width="400" height="400" fill="#f3f4ef" />
        {image && (
          <image
            href={image}
            width="400"
            height="400"
            preserveAspectRatio="none"
            opacity=".8"
          />
        )}
        <polygon
          points={points.map(p => `${p[0] * 400},${p[1] * 400}`).join(" ")}
          fill="#69977325"
          stroke="#285a40"
          strokeWidth="2"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p[0] * 400} cy={p[1] * 400} r="4" fill="#285a40" />
            <text x={p[0] * 400 + 6} y={p[1] * 400 - 6} fontSize="10">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div>
        <button
          onClick={() => onChange(points.slice(0, -1))}
          disabled={!points.length}
        >
          마지막 점 되돌리기
        </button>
        <button onClick={() => onChange([])} disabled={!points.length}>
          윤곽 초기화
        </button>
      </div>
      <details>
        <summary>좌표로 점 추가 · 수정</summary>
        <p>0~1 사이 좌표입니다. 이미지 왼쪽 위가 0, 0입니다.</p>
        {points.map((p, i) => (
          <div key={i} className="at-point">
            <span>{i + 1}</span>
            {[0, 1].map(axis => (
              <input
                key={axis}
                aria-label={`${label} 점 ${i + 1} ${axis === 0 ? "가로" : "세로"}`}
                type="number"
                min="0"
                max="1"
                step=".01"
                value={p[axis]}
                onChange={e => {
                  const next = points.map(v => [...v] as Point);
                  next[i][axis] = Math.max(
                    0,
                    Math.min(1, Number(e.target.value))
                  );
                  onChange(next);
                }}
              />
            ))}
          </div>
        ))}
        <button
          onClick={() => onChange([...points, [0.5, 0.5]])}
          disabled={points.length >= 128}
        >
          중앙에 점 추가
        </button>
      </details>
    </div>
  );
}
