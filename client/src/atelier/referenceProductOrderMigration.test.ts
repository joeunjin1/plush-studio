import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../../supabase/migrations/202609100013_reference_product_order_requests.sql", import.meta.url),
  "utf8"
);

describe("reference product order migration", () => {
  it("stores buyer-company order metadata without raw personalization bytes", () => {
    expect(source).toContain("reference_product_order_requests");
    expect(source).toContain("buyer_company_id uuid not null");
    expect(source).toContain("personalization_image_path text");
    expect(source).not.toMatch(/\b(blob|bytea)\b/i);
  });

  it("keeps personalization assets private and binds client writes to the buyer request path", () => {
    expect(source).toContain("'buyer-personalization-assets'");
    expect(source).toContain("public, file_size_limit, allowed_mime_types");
    expect(source).toContain("and (storage.foldername(name))[1] = auth.uid()::text");
    expect(source).toContain("INVALID_PERSONALIZATION_ASSET_PATH");
  });

  it("uses an authenticated idempotent submit function instead of direct browser table inserts", () => {
    expect(source).toContain("if who is null then");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("submit_reference_product_order");
    expect(source).toContain("grant execute on function public.submit_reference_product_order");
  });
});
