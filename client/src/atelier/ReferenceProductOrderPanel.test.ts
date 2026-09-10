import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./ReferenceProductOrderPanel.tsx", import.meta.url),
  "utf8"
);

describe("reference product order panel", () => {
  it("keeps the official-product request journey in four reviewable steps", () => {
    expect(source).toContain('const steps = ["개인화 확인", "수량 · 납기", "담당자", "최종 요청"]');
    expect(source).toContain("ORDER REQUEST · STEP");
    expect(source).toContain("개인화 프리뷰와 5면 사진을 확인");
  });

  it("collects quantity, delivery, contact, consent, and purpose with mobile-suitable inputs", () => {
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('type="date"');
    expect(source).toContain('autoComplete="organization"');
    expect(source).toContain('autoComplete="name"');
    expect(source).toContain('autoComplete="tel"');
    expect(source).toContain('type="checkbox"');
  });

  it("does not claim payment or bypass the email-authenticated submit boundary", () => {
    expect(source).toContain("결제나 발주가 확정된 단계는 아닙니다");
    expect(source).toContain("이메일 인증 후 요청 보내기");
    expect(source).not.toContain(".from(");
  });

  it("offers an explicit same-product new-request path after receipt", () => {
    expect(source).toContain("같은 상품 새 요청");
    expect(source).toContain("onStartNew");
    expect(source).toContain("내 제작 요청 확인");
  });
});
