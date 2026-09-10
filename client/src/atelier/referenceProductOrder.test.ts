import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearReferenceProductOrderDraft, createReferenceProductOrderDraft, persistReferenceProductOrderDraft, referenceProductOrderDraftSchema, referenceProductOrderSnapshot, referenceProductOrderSubmissionSchema, restoreReferenceProductOrderDraft } from "./referenceProductOrder";
import { referenceProducts } from "./referenceProducts";
import { personalizationProfiles } from "./personalizationProfiles";

describe("reference product order contract", () => {
  const product = referenceProducts[0]!;
  const profile = personalizationProfiles.find(item => item.id === "memorial-tag-text-v01")!;
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
  });

  it("starts with a product-bound, reviewable order draft", () => {
    const draft = createReferenceProductOrderDraft("3d1236d5-557c-4b21-b2f2-4ccd4836c190", product);
    expect(draft.productId).toBe(product.id);
    expect(draft.quantity).toBe(100);
    expect(draft.consent).toBe(false);
  });

  it("requires consent and a valid buyer contact before submission", () => {
    const draft = createReferenceProductOrderDraft("3d1236d5-557c-4b21-b2f2-4ccd4836c190", product);
    expect(referenceProductOrderDraftSchema.safeParse(draft).success).toBe(true);
    expect(referenceProductOrderSubmissionSchema.safeParse(draft).success).toBe(false);
    expect(referenceProductOrderSubmissionSchema.safeParse({
      ...draft,
      personalizationProfileId: profile.id,
      personalizationText: "Always with us",
      companyName: "MOLIPOP",
      contactName: "김대표",
      consent: true,
    }).success).toBe(true);
  });

  it("snapshots source product and optional owner-model version without raw URLs", () => {
    const draft = createReferenceProductOrderDraft("3d1236d5-557c-4b21-b2f2-4ccd4836c190", product);
    const productWithOwnerModel = {
      ...product,
      model3d: {
        label: "대표 제공 GLB 3D 제품 뷰",
        source: "https://staging.example.invalid/bernese-v02.glb",
        version: "v02",
        checksumSha256: "eeebf4aba5861150ae0eca006cf85bb7d0583e7b9400c15ff60ac2106ac647d5",
      },
    };
    const snapshot = referenceProductOrderSnapshot(productWithOwnerModel, profile, { ...draft, personalizationProfileId: profile.id });
    expect(snapshot.sku).toBe("PS-BERNESE-MEMORIAL-001");
    expect(snapshot.modelVersion).toBe("v02");
    expect(snapshot).not.toHaveProperty("source");
  });

  it("preserves an incomplete order draft for the Magic Link return path", () => {
    const draft = createReferenceProductOrderDraft("3d1236d5-557c-4b21-b2f2-4ccd4836c190", product);
    persistReferenceProductOrderDraft({ ...draft, personalizationText: "Always with us" });
    expect(restoreReferenceProductOrderDraft(product.id)?.personalizationText).toBe("Always with us");
    clearReferenceProductOrderDraft();
    expect(restoreReferenceProductOrderDraft(product.id)).toBeNull();
  });
});
