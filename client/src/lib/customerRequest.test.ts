import { describe, it, expect, vi } from "vitest";
vi.mock("./supabase", () => ({ supabase: null }));
import { customerDraftSchema, contactSchema } from "./customerRequest";
import { initialDesign } from "./studioTypes";
const draft = {
  design: initialDesign,
  quantity: 100,
  material: "soft",
  purpose: "sample",
  notes: "",
};
describe("customer submission validation", () => {
  it("accepts a valid design but rejects invalid quantities and missing names", () => {
    expect(customerDraftSchema.safeParse(draft).success).toBe(true);
    for (const quantity of [0, -1, 1.5, 100001, NaN])
      expect(
        customerDraftSchema.safeParse({ ...draft, quantity }).success
      ).toBe(false);
    expect(
      customerDraftSchema.safeParse({
        ...draft,
        design: { ...initialDesign, name: "" },
      }).success
    ).toBe(false);
  });
  it("bounds imported designs and rejects malformed colors", () => {
    for (const heightCm of [0, 101, Infinity])
      expect(
        customerDraftSchema.safeParse({
          ...draft,
          design: { ...initialDesign, heightCm },
        }).success
      ).toBe(false);
    expect(
      customerDraftSchema.safeParse({
        ...draft,
        design: { ...initialDesign, color: "url(javascript:bad)" },
      }).success
    ).toBe(false);
  });
  it("requires contact consent and allows an omitted optional telephone", () => {
    expect(
      contactSchema.safeParse({ name: "고객", phone: "", consent: true })
        .success
    ).toBe(true);
    expect(
      contactSchema.safeParse({ name: "고객", phone: "", consent: false })
        .success
    ).toBe(false);
    expect(
      contactSchema.safeParse({ name: "고객", phone: "invalid", consent: true })
        .success
    ).toBe(false);
  });
});
