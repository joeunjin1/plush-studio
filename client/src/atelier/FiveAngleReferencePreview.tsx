import { useEffect, useState } from "react";
import { Pause, Play, Rotate3D } from "lucide-react";
import {
  constrainMemorialMessage,
  referenceViewIds,
  type MemorialTagSide,
  type ReferenceProduct,
  type ReferenceViewId,
} from "./referenceProducts";

type Props = {
  product: ReferenceProduct;
  onMessage: (message: string) => void;
};

export function FiveAngleReferencePreview({ product, onMessage }: Props) {
  const [view, setView] = useState<ReferenceViewId>("front");
  const [tagSide, setTagSide] = useState<MemorialTagSide>("front");
  const [tagMessage, setTagMessage] = useState("");
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => {
      setView(current => {
        const index = referenceViewIds.indexOf(current);
        return referenceViewIds[(index + 1) % referenceViewIds.length];
      });
    }, 1450);
    return () => window.clearInterval(timer);
  }, [rotating]);

  const selectView = (next: ReferenceViewId) => {
    setRotating(false);
    setView(next);
  };

  return (
    <section className="at-reference-preview" aria-label={`${product.title} 5면 기준 프리뷰`}>
      <div className="at-reference-heading">
        <div>
          <span>REFERENCE PRODUCT · 5-VIEW</span>
          <h2>{product.title}</h2>
        </div>
        <p>{product.reviewLabel}</p>
      </div>

      <div className="at-reference-image-stage">
        <img
          alt={`${product.title} ${product.views[view].label} 기준 이미지`}
          className="at-reference-main-image"
          src={product.views[view].image}
        />
        <div className="at-reference-view-badge" aria-live="polite">
          {product.views[view].label}
        </div>
      </div>

      <div className="at-reference-view-controls" aria-label="기준 이미지 면 선택">
        {referenceViewIds.map(id => (
          <button
            aria-pressed={view === id}
            key={id}
            onClick={() => selectView(id)}
          >
            {product.views[id].label}
          </button>
        ))}
        <button
          aria-pressed={rotating}
          className="at-reference-rotate"
          onClick={() => setRotating(value => !value)}
        >
          {rotating ? <Pause size={15} /> : <Play size={15} />}
          {rotating ? "회전 멈춤" : "5면 자동 회전"}
        </button>
      </div>

      <div className="at-reference-explainer">
        <Rotate3D size={16} />
        <p>
          다섯 장의 검수 기준 사진을 면별로 전환하는 가상 3D 프리뷰입니다. 실제 메시·UV·깊이 정보가 있는 GLB 디지털 트윈과는 다르며, 판매 전 실측·소재·제작 검수가 필요합니다.
        </p>
      </div>

      {product.memorialTag.enabled && (
        <section className="at-memorial-customizer" aria-label="교체형 기념택 문구 설정">
          <div className="at-memorial-copy">
            <span>REPLACEABLE MEMORIAL TAG</span>
            <h3>기념 문구를 미리 보세요</h3>
            <p>문구는 주문 검토용 프리뷰입니다. 인쇄 방식·서체·줄바꿈·최종 위치는 제작 승인 후 확정합니다.</p>
            <div className="at-memorial-side-options">
              {(Object.keys(product.memorialTag.sides) as MemorialTagSide[]).map(side => (
                <button
                  aria-pressed={tagSide === side}
                  key={side}
                  onClick={() => setTagSide(side)}
                >
                  {product.memorialTag.sides[side].label}
                </button>
              ))}
            </div>
            <label className="at-memorial-input">
              <span>기념 문구 · 최대 {product.memorialTag.maxCharacters}자</span>
              <textarea
                maxLength={product.memorialTag.maxCharacters}
                onChange={event =>
                  setTagMessage(
                    constrainMemorialMessage(
                      event.target.value,
                      product.memorialTag.maxCharacters,
                      product.memorialTag.maxLines
                    )
                  )
                }
                placeholder="예: Always with us\n2026.09.06"
                rows={3}
                value={tagMessage}
              />
              <small>{tagMessage.length} / {product.memorialTag.maxCharacters}</small>
            </label>
            <button
              className="at-primary"
              disabled={!tagMessage.trim()}
              onClick={() => onMessage("기념 문구를 현재 상품 프리뷰에 적용했습니다. 제작 접수 전 문구와 위치를 다시 확인해 주세요.")}
            >
              기념 문구 프리뷰 적용
            </button>
          </div>
          <div className="at-memorial-tag-preview" aria-label={`${product.memorialTag.sides[tagSide].label} 프리뷰`}>
            <img alt="교체형 기념택 빈 양식" src={product.memorialTag.sides[tagSide].image} />
            <p>{tagMessage.trim() || "기념 문구"}</p>
            <small>{product.memorialTag.sides[tagSide].label}</small>
          </div>
        </section>
      )}
    </section>
  );
}
