import { ArrowLeft, ArrowRight, Check, PackageCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { profilesForReferenceProduct } from "./personalizationProfiles";
import type { ReferenceProduct } from "./referenceProducts";
import {
  referenceOrderPurposeOptions,
  type ReferenceProductOrderDraft,
} from "./referenceProductOrder";

type Props = {
  authenticatedEmail?: string | null;
  busy: boolean;
  draft: ReferenceProductOrderDraft;
  onChange: (patch: Partial<ReferenceProductOrderDraft>) => void;
  onSubmit: () => void;
  product: ReferenceProduct;
  receipt: string;
};

const steps = ["개인화 확인", "수량 · 납기", "담당자", "최종 요청"];

export function ReferenceProductOrderPanel({
  authenticatedEmail,
  busy,
  draft,
  onChange,
  onSubmit,
  product,
  receipt,
}: Props) {
  const [step, setStep] = useState(0);
  const profiles = profilesForReferenceProduct(product.family, product.personalizationProfileIds);
  const profile = profiles.find(item => item.id === draft.personalizationProfileId);
  const canAdvance = [
    Boolean(profile && (draft.personalizationText.trim() || draft.personalizationArtwork)),
    Number.isInteger(draft.quantity) && draft.quantity >= 1 && draft.quantity <= 100000,
    draft.companyName.trim().length >= 2 && draft.contactName.trim().length >= 2 && draft.consent,
    Boolean(profile && (draft.personalizationText.trim() || draft.personalizationArtwork) && draft.companyName.trim() && draft.contactName.trim() && draft.consent),
  ][step];

  const move = (next: number) => {
    if (next < step || canAdvance) setStep(next);
  };

  if (receipt) {
    return (
      <section className="at-reference-order at-reference-order--success" aria-live="polite">
        <PackageCheck size={28} />
        <span>REQUEST RECEIVED</span>
        <h2>제작 요청을 접수했습니다.</h2>
        <p>결제나 발주가 확정된 단계는 아닙니다. 상품 사양과 개인화 내용을 검토한 뒤 로그인 이메일로 안내합니다.</p>
        <p className="at-reference-order-receipt">접수번호 · {receipt}</p>
        <a className="at-primary" href="#requests">내 제작 요청 확인</a>
      </section>
    );
  }

  return (
    <section className="at-reference-order" aria-label="공식 상품 제작 요청">
      <div className="at-reference-order-heading">
        <span>ORDER REQUEST · STEP {String(step + 1).padStart(2, "0")}</span>
        <h2>{steps[step]}</h2>
        <p>결제 전 제작 사양을 확인하는 요청 단계입니다. 입력 내용은 다음 단계로 이동해도 유지됩니다.</p>
      </div>
      <nav className="at-reference-order-steps" aria-label="공식 상품 주문 단계">
        {steps.map((label, index) => (
          <button
            aria-current={step === index ? "step" : undefined}
            disabled={index > step + 1}
            key={label}
            onClick={() => move(index)}
            type="button"
          >
            <span>{index < step ? <Check size={14} /> : String(index + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </nav>

      {step === 0 && (
        <div className="at-reference-order-section">
          <div className="at-reference-order-summary">
            <img alt={`${product.title} 정면 기준 이미지`} src={product.views.front.image} />
            <div>
              <span>OFFICIAL PRODUCT</span>
              <b>{product.title}</b>
              <small>{product.sku} · {product.colorLabel}</small>
              <small>{profile ? `${profile.label} · ${draft.placementLabel}` : "개인화 방식을 먼저 선택해 주세요."}</small>
            </div>
          </div>
          {profile ? (
            <div className="at-reference-order-review-copy">
              <b>적용 내용</b>
              <p>{draft.personalizationText.trim() || draft.personalizationArtwork?.name}</p>
              <small>공장 검토 기준 · {profile.factoryReviewNote}</small>
            </div>
          ) : (
            <p className="at-reference-order-warning">상품 프리뷰의 개인화 방식과 내용을 먼저 선택해 주세요.</p>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="at-reference-order-section at-reference-order-fields">
          <label className="at-field">
            <span>희망 수량</span>
            <input
              inputMode="numeric"
              max="100000"
              min="1"
              onChange={event => onChange({ quantity: Number(event.target.value) })}
              type="number"
              value={draft.quantity}
            />
            <small>1~100,000개 범위에서 입력해 주세요. MOQ와 단가는 검토 후 안내합니다.</small>
          </label>
          <label className="at-field">
            <span>희망 납기일 <em>선택</em></span>
            <input
              min={new Date().toISOString().slice(0, 10)}
              onChange={event => onChange({ desiredDeliveryDate: event.target.value })}
              type="date"
              value={draft.desiredDeliveryDate}
            />
          </label>
          <fieldset className="at-reference-order-purpose">
            <legend>이번 요청의 목적</legend>
            {referenceOrderPurposeOptions.map(([value, label]) => (
              <label key={value}>
                <input
                  checked={draft.purpose === value}
                  name="reference-order-purpose"
                  onChange={() => onChange({ purpose: value })}
                  type="radio"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <label className="at-field">
            <span>추가 요청 <em>선택</em></span>
            <textarea
              maxLength={3000}
              onChange={event => onChange({ orderNote: event.target.value })}
              placeholder="용도, 희망 포장, 납기 관련 참고 사항을 적어 주세요."
              rows={3}
              value={draft.orderNote}
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="at-reference-order-section at-reference-order-fields">
          <p className="at-reference-order-auth"><ShieldCheck size={16} /> {authenticatedEmail ? `${authenticatedEmail}로 인증되었습니다.` : "최종 요청을 보낼 때 이메일 인증을 요청합니다."}</p>
          <label className="at-field">
            <span>회사명 또는 상호</span>
            <input
              autoComplete="organization"
              maxLength={160}
              onChange={event => onChange({ companyName: event.target.value })}
              placeholder="예: MOLIPOP"
              value={draft.companyName}
            />
          </label>
          <label className="at-field">
            <span>담당자 이름</span>
            <input
              autoComplete="name"
              maxLength={80}
              onChange={event => onChange({ contactName: event.target.value })}
              placeholder="성함을 입력해 주세요"
              value={draft.contactName}
            />
          </label>
          <label className="at-field">
            <span>전화번호 <em>선택</em></span>
            <input
              autoComplete="tel"
              inputMode="tel"
              maxLength={30}
              onChange={event => onChange({ contactPhone: event.target.value })}
              placeholder="급한 확인이 필요한 경우에만 사용합니다"
              type="tel"
              value={draft.contactPhone}
            />
          </label>
          <label className="at-consent">
            <input checked={draft.consent} onChange={event => onChange({ consent: event.target.checked })} type="checkbox" />
            제작 상담과 견적 검토를 위해 입력한 연락처 및 주문 사양을 운영자에게 전달하는 데 동의합니다.
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="at-reference-order-section">
          <div className="at-reference-order-final-grid">
            <div><span>상품</span><b>{product.title}</b><small>{product.sku} · 기준 v01</small></div>
            <div><span>개인화</span><b>{profile?.label}</b><small>{draft.placementLabel}</small></div>
            <div><span>수량 · 납기</span><b>{draft.quantity.toLocaleString()}개</b><small>{draft.desiredDeliveryDate || "희망 납기 미입력"}</small></div>
            <div><span>연락</span><b>{draft.companyName}</b><small>{draft.contactName} · {authenticatedEmail || "이메일 인증 필요"}</small></div>
          </div>
          <p className="at-reference-order-disclaimer">요청 전 개인화 프리뷰와 5면 사진을 확인해 주세요. 실제 샘플·원단·색상·인쇄 방식은 공장 검토 후 확정됩니다.</p>
        </div>
      )}

      <div className="at-reference-order-actions">
        {step > 0 && <button onClick={() => setStep(current => current - 1)} type="button"><ArrowLeft size={16} /> 이전</button>}
        {step < steps.length - 1 ? (
          <button className="at-primary" disabled={!canAdvance} onClick={() => setStep(current => current + 1)} type="button">다음 <ArrowRight size={16} /></button>
        ) : (
          <button className="at-primary" disabled={!canAdvance || busy} onClick={onSubmit} type="button">{busy ? "요청을 접수하는 중…" : authenticatedEmail ? "제작 요청 보내기" : "이메일 인증 후 요청 보내기"}</button>
        )}
      </div>
    </section>
  );
}
