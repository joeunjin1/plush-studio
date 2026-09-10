import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../supabase/manual/20260910_verify_reference_order_uat.sql", import.meta.url),
  "utf8"
);
const singleResultSource = readFileSync(
  new URL("../../../supabase/manual/20260910_verify_reference_order_uat_metadata_only.sql", import.meta.url),
  "utf8"
);

describe("reference product order UAT verification query", () => {
  it("is transactionally read-only and checks exactly one known request", () => {
    expect(source).toContain("begin read only");
    expect(source).toContain("matching_request_count");
    expect(source).toContain("ea24e2bc-2a05-4c33-88ca-e4a194dfdaaf");
  });

  it("reports only metadata states without selecting private user content", () => {
    expect(source).toContain("personalization_storage_state");
    expect(source).toContain("model_checksum_state");
    expect(source).not.toMatch(/^\s*(personalization_text|personalization_image_path|contact_name|contact_phone)\s*,?$/m);
  });

  it("offers an Editor-friendly single result set without private user content", () => {
    expect(singleResultSource).toContain("personalization_storage_state");
    expect(singleResultSource).toContain("model_checksum_state");
    expect(singleResultSource).not.toContain("begin read only");
    expect(singleResultSource).not.toMatch(/^\s*(personalization_text|personalization_image_path|contact_name|contact_phone)\s*,?$/m);
  });
});
