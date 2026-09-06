import { useEffect, useState } from "react";
import { Pause, Play, Rotate3D } from "lucide-react";
import {
  constrainMemorialMessage,
  referenceViewIds,
  type MemorialTagSide,
  type ReferenceProduct,
  type ReferenceViewId,
} from "./referenceProducts";
import {
  constrainPersonalizationText,
  profilesForReferenceProduct,
  validatePersonalizationFile,
} from "./personalizationProfiles";

type Props = {
  product: ReferenceProduct;
  onMessage: (message: string) => void;
};

export function FiveAngleReferencePreview({ product, onMessage }: Props) {
  const [view, setView] = useState<ReferenceViewId>("front");
  const [tagSide, setTagSide] = useState<MemorialTagSide>("front");
  const [tagMessage, setTagMessage] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [tagArtwork, setTagArtwork] = useState<string | null>(null);
  const [inputError, setInputError] = useState("");
  const [personalizationStep, setPersonalizationStep] = useState<"method" | "content" | "review">("method");
  const [rotating, setRotating] = useState(false);
  const profiles = profilesForReferenceProduct(product.family, product.personalizationProfileIds);
  const selectedProfile = profiles.find(profile => profile.id === selectedProfileId) ?? null;

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
            {personalizationStep === "method" && (
              <>
                <h3>어떤 방식으로 적용할까요?</h3>
                <p>상품에 등록된 제작 방식만 선택할 수 있습니다. 선택 내용은 주문 검토용 프리뷰이며, 제작 승인 파일이 아닙니다.</p>
                <div className="at-personalization-options" aria-label="개인화 방식 선택">
                  {profiles.map(profile => (
                    <button
                      aria-pressed={selectedProfileId === profile.id}
                      key={profile.id}
                      onClick={() => {
                        setSelectedProfileId(profile.id);
                        setInputError("");
                        setPersonalizationStep("content");
                      }}
                    >
                      <b>{profile.label}</b>
                      <small>{profile.description}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            {selectedProfile && personalizationStep === "content" && (
              <div className="at-personalization-editor">
                <h3>{selectedProfile.inputMode === "image" ? "브랜드 마크를 올려 주세요" : "기념 문구를 입력해 주세요"}</h3>
                <p><b>{selectedProfile.label}</b> · {selectedProfile.constraints.safeAreaLabel}</p>
                <p className="at-factory-review-note"><b>공장 검토 기준</b> · {selectedProfile.factoryReviewNote}</p>
                {selectedProfile.inputMode !== "image" && (
                  <label className="at-memorial-input">
                    <span>기념 문구 · 최대 {selectedProfile.constraints.maxCharacters}자</span>
                    <textarea
                      maxLength={selectedProfile.constraints.maxCharacters}
                      onChange={event =>
                        setTagMessage(
                          constrainPersonalizationText(event.target.value, selectedProfile.constraints)
                        )
                      }
                      placeholder="예: Always with us\n2026.09.06"
                      rows={selectedProfile.constraints.maxLines ?? 3}
                      value={tagMessage}
                    />
                    <small>{tagMessage.length} / {selectedProfile.constraints.maxCharacters}</small>
                  </label>
                )}
                {selectedProfile.inputMode !== "text" && (
                  <label className="at-personalization-upload">
                    <span>브랜드 마크 이미지 첨부</span>
                    <input
                      accept={selectedProfile.constraints.acceptedMimeTypes?.join(",")}
                      aria-label="브랜드 마크 이미지 첨부"
                      type="file"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const error = validatePersonalizationFile(file, selectedProfile.constraints);
                        if (error) {
                          setInputError(error);
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setTagArtwork(typeof reader.result === "string" ? reader.result : null);
                          setInputError("");
                        };
                        reader.onerror = () => setInputError("이미지를 읽지 못했습니다. 다른 파일로 다시 시도해 주세요.");
                        reader.readAsDataURL(file);
                      }}
                    />
                    <small>PNG, JPG, WebP · 최대 {selectedProfile.constraints.maximumFileMegabytes}MB</small>
                  </label>
                )}
                {inputError && <p className="at-personalization-error" role="alert">{inputError}</p>}
                <div className="at-personalization-actions">
                  <button onClick={() => setPersonalizationStep("method")}>방식 다시 고르기</button>
                  <button
                    className="at-primary"
                    disabled={selectedProfile.inputMode === "text" ? !tagMessage.trim() : !tagArtwork}
                    onClick={() => {
                      setPersonalizationStep("review");
                      onMessage("개인화 프리뷰를 만들었습니다. 아래 택 면과 안전 영역을 확인해 주세요.");
                    }}
                  >
                    프리뷰 확인
                  </button>
                </div>
              </div>
            )}
            {selectedProfile && personalizationStep === "review" && (
              <div className="at-personalization-review">
                <h3>적용 위치를 확인해 주세요</h3>
                <p>{selectedProfile.label} · {selectedProfile.constraints.safeAreaLabel}. 아래 택 이미지는 제작 검토용 프리뷰입니다.</p>
                <p className="at-factory-review-note"><b>공장 검토 기준</b> · {selectedProfile.factoryReviewNote}</p>
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
                <div className="at-personalization-actions">
                  <button onClick={() => setPersonalizationStep("content")}>내용 수정</button>
                  <button
                    className="at-primary"
                    onClick={() => onMessage(`${selectedProfile.label} 프리뷰를 적용했습니다. 제작 접수 전 안전 영역과 제작 방식 조건을 다시 확인해 주세요.`)}
                  >
                    이 개인화 방식 선택
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="at-memorial-tag-preview" aria-label={`${product.memorialTag.sides[tagSide].label} 프리뷰`}>
            <img alt="교체형 기념택 빈 양식" src={product.memorialTag.sides[tagSide].image} />
            {selectedProfile?.inputMode === "image" && tagArtwork ? (
              <img alt="첨부한 브랜드 마크 프리뷰" className="at-memorial-artwork" src={tagArtwork} />
            ) : (
              <p>{tagMessage.trim() || "기념 문구"}</p>
            )}
            <small>{product.memorialTag.sides[tagSide].label}</small>
          </div>
        </section>
      )}
    </section>
  );
}
