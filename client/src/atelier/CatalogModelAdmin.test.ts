import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CatalogModelAdmin.tsx", import.meta.url), "utf8");

describe("protected owner GLB intake screen", () => {
  it("keeps newly received originals in private organization-scoped storage", () => {
    expect(source).toContain('.from("plush-studio")');
    expect(source).toContain("ownerModelStoragePath(organizationId, modelVersion, file.name)");
    expect(source).toContain('source_storage_bucket: "plush-studio"');
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("keeps the first registration as a non-public draft with review pending", () => {
    expect(source).toContain('checksum_verification_state: "pending"');
    expect(source).toContain('review_state: "draft"');
    expect(source).toContain("공개 카탈로그에는 반영되지 않았습니다.");
  });

  it("gates the surface by authenticated brand-admin membership and migration availability", () => {
    expect(source).toContain('.eq("role", "brand_admin")');
    expect(source).toContain('modelError.code === "42P01"');
    expect(source).toContain("관리자 로그인 링크 받기");
  });

  it("reuses the established magic-link redirect and error classification", () => {
    expect(source).toContain("emailRedirectTo: buyerEmailRedirectUrl()");
    expect(source).toContain("buyerMagicLinkErrorMessage(error)");
  });
});
