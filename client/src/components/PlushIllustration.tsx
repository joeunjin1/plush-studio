import type { DesignState } from "@/lib/studioTypes";
/** Lightweight, honest 2D preview also usable on devices without WebGL. */
export function PlushIllustration({
  design,
  compact = false,
}: {
  design: DesignState;
  compact?: boolean;
}) {
  const { color, accent, kind } = design;
  return (
    <svg
      viewBox="0 0 320 340"
      role="img"
      aria-label={`${kind === "bear" ? "곰" : kind === "rabbit" ? "토끼" : "고양이"} 인형 정면 일러스트`}
      className={compact ? "plush-art compact" : "plush-art"}
    >
      <ellipse cx="160" cy="307" rx="87" ry="13" fill="#283f3512" />
      <g fill={color} stroke="#00000012" strokeWidth="2">
        <ellipse
          cx="97"
          cy="213"
          rx="23"
          ry="43"
          transform="rotate(22 97 213)"
        />
        <ellipse
          cx="223"
          cy="213"
          rx="23"
          ry="43"
          transform="rotate(-22 223 213)"
        />
        <ellipse cx="160" cy="229" rx={58 * design.bodyScale} ry="65" />
        <ellipse cx="124" cy="286" rx="31" ry="24" />
        <ellipse cx="196" cy="286" rx="31" ry="24" />
        {kind === "cat" ? (
          <>
            <path d="M94 111 L92 35 L143 86Z" />
            <path d="M177 86 L228 35 L226 111Z" />
          </>
        ) : (
          <>
            <ellipse
              cx="106"
              cy={kind === "rabbit" ? 65 : 93}
              rx="28"
              ry={kind === "rabbit" ? 56 : 29}
            />
            <ellipse
              cx="214"
              cy={kind === "rabbit" ? 65 : 93}
              rx="28"
              ry={kind === "rabbit" ? 56 : 29}
            />
          </>
        )}
        <ellipse cx="160" cy="142" rx={76 * design.headScale} ry="68" />
      </g>
      <ellipse cx="160" cy="234" rx="36" ry="43" fill={accent} />
      <ellipse cx="160" cy="166" rx="32" ry="24" fill={accent} />
      <g fill="#342c2a">
        <ellipse cx="133" cy="143" rx="5" ry="7" />
        <ellipse cx="187" cy="143" rx="5" ry="7" />
        <ellipse cx="160" cy="159" rx="7" ry="5" />
      </g>
      <path
        d="M160 163v8m-10 0q10 12 20 0"
        stroke="#342c2a"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <g fill="#fff" opacity=".5">
        <circle cx="131" cy="141" r="1.5" />
        <circle cx="185" cy="141" r="1.5" />
      </g>
      {design.keyring && (
        <circle
          cx="160"
          cy="56"
          r="17"
          fill="none"
          stroke="#9c9f98"
          strokeWidth="4"
        />
      )}
    </svg>
  );
}
