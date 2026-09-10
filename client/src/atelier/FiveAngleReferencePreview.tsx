import { lazy, Suspense, useEffect, useState } from "react";
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
import type { ReferenceProductOrderDraft } from "./referenceProductOrder";

const BerneseModelViewer = lazy(() => import("./BerneseModelViewer"));

type Props = {
  product: ReferenceProduct;
  onMessage: (message: string) => void;
  onPersonalizationConfirm: (
    selection: Pick<
      ReferenceProductOrderDraft,
      "personalizationProfileId" | "personalizationText" | "personalizationArtwork" | "placementLabel"
    >
  ) => void;
};

export function FiveAngleReferencePreview({ product, onMessage, onPersonalizationConfirm }: Props) {
  const [view, setView] = useState<ReferenceViewId>("front");
  const [tagSide, setTagSide] = useState<MemorialTagSide>("front");
  const [tagMessage, setTagMessage] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [tagArtwork, setTagArtwork] = useState<ReferenceProductOrderDraft["personalizationArtwork"]>(null);
  const [inputError, setInputError] = useState("");
  const [personalizationStep, setPersonalizationStep] = useState<"method" | "content" | "review">("method");
  const [rotating, setRotating] = useState(false);
  const [previewMode, setPreviewMode] = useState<"photo" | "model">("photo");
  const [previousView, setPreviousView] = useState<ReferenceViewId | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const profiles = profilesForReferenceProduct(product.family, product.personalizationProfileIds);
  const selectedProfile = profiles.find(profile => profile.id === selectedProfileId) ?? null;

  useEffect(() => {
    Object.values(product.views).forEach(({ image }) => {
      const preload = new Image();
      preload.src = image;
    });
  }, [product]);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => {
      setView(current => {
        const index = referenceViewIds.indexOf(current);
        return referenceViewIds[(index + 1) % referenceViewIds.length];
      });
    }, 2400);
    return () => window.clearInterval(timer);
  }, [rotating]);

  const selectView = (next: ReferenceViewId) => {
    setRotating(false);
    setPreviewMode("photo");
    if (next !== view) {
      setPreviousView(view);
      window.setTimeout(() => setPreviousView(null), 420);
    }
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
        {previewMode === "model" && product.model3d ? (
          <Suspense fallback={<p className="at-reference-image-fallback">3D 제품 뷰를 준비하는 중입니다.</p>}>
            <BerneseModelViewer
              onUnavailable={() => {
                setPreviewMode("photo");
                setRotating(false);
                onMessage("3D 제품 뷰를 불러오지 못해 검수된 5면 사진 프리뷰로 전환했습니다.");
              }}
              src={product.model3d.source}
            />
          </Suspense>
        ) : previousView && (
          <img
            alt=""
            aria-hidden="true"
            className="at-reference-main-image at-reference-main-image--outgoing"
            src={product.views[previousView].image}
          />
        )}
        {previewMode === "photo" && !failedImages.includes(product.views[view].image) ? (
          <img
            alt={`${product.title} ${product.views[view].label} 기준 이미지`}
            className="at-reference-main-image at-reference-main-image--incoming"
            onError={() =>
              setFailedImages(items =>
                items.includes(product.views[view].image)
                  ? items
                  : [...items, product.views[view].image]
              )
            }
            src={product.views[view].image}
          />
        ) : previewMode === "photo" ? (
          <p className="at-reference-image-fallback">이 기준 이미지를 불러오지 못했습니다. 다른 면을 선택하거나 관리자에게 알려주세요.</p>
        ) : null}
        <div className="at-reference-view-badge" aria-live="polite">
          {previewMode === "model" ? "GLB 3D 제품 뷰" : product.views[view].label}
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
          onClick={() => {
            setPreviewMode("photo");
            setRotating(value => !value);
          }}
        >
          {rotating ? <Pause size={15} /> : <Play size={15} />}
          {rotating ? "사진 회전 멈춤" : "사진 부드러운 회전"}
        </button>
        {product.model3d && (
          <button
            aria-pressed={previewMode === "model"}
            className="at-reference-rotate"
            onClick={() => {
              setRotating(false);
              setPreviewMode("model");
            }}
          >
            <Rotate3D size={15} />
            {product.model3d.label} · {product.model3d.version}
          </button>
        )}
      </div>

      <div className="at-reference-explainer">
        <Rotate3D size={16} />
        <p>
          5면 사진은 검수 기준을 부드럽게 전환합니다. 3D 제품 뷰는 대표 제공 GLB의 실제 메시를 회전·확대하는 참고용 프리뷰이며, 판매 전 실측·소재·제작 검수가 필요합니다.
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
                          setTagArtwork(typeof reader.result === "string" ? {
                            dataUrl: reader.result,
                            name: file.name,
                            mimeType: file.type as "image/png" | "image/jpeg" | "image/webp",
                            byteSize: file.size,
                          } : null);
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
                    onClick={() => {
                      onPersonalizationConfirm({
                        personalizationProfileId: selectedProfile.id,
                        personalizationText: tagMessage,
                        personalizationArtwork: tagArtwork,
                        placementLabel: product.memorialTag.sides[tagSide].label,
                      });
                      onMessage(`${selectedProfile.label} 프리뷰를 주문 요약에 반영했습니다. 수량과 희망 납기를 확인해 주세요.`);
                    }}
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
              <img alt="첨부한 브랜드 마크 프리뷰" className="at-memorial-artwork" src={tagArtwork.dataUrl} />
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
