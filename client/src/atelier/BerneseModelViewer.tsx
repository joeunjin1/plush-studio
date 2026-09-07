import { createElement, useEffect, useState } from "react";
import "@google/model-viewer";

type Props = {
  src: string;
  onUnavailable: () => void;
};

export default function BerneseModelViewer({ src, onUnavailable }: Props) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [src]);

  return (
    <div className="at-bernese-model-viewer" aria-label="버니즈 기념 독 인형 3D 제품 뷰">
      {createElement("model-viewer", {
        alt: "버니즈 기념 독 인형의 실제 GLB 3D 제품 뷰",
        "auto-rotate": true,
        "auto-rotate-delay": "0",
        "camera-controls": true,
        "environment-image": "neutral",
        exposure: "1",
        "interaction-prompt": "none",
        onError: onUnavailable,
        onLoad: () => setLoading(false),
        "rotation-per-orbit": "22s",
        "shadow-intensity": "1",
        src,
      })}
      {loading && <p className="at-model-loading" role="status">3D 제품 모델을 불러오는 중입니다.</p>}
    </div>
  );
}
