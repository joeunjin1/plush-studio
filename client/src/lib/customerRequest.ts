import { z } from "zod";
import { supabase } from "./supabase";
export const customerDraftSchema = z.object({
  design: z.object({
    name: z.string().trim().min(1).max(100),
    kind: z.enum(["bear", "rabbit", "cat"]),
    heightCm: z.number().min(8).max(100),
    headScale: z.number().min(0.7).max(1.3),
    bodyScale: z.number().min(0.7).max(1.3),
    earScale: z.number().min(0.5).max(2),
    color: z.string().regex(/^#[a-f0-9]{6}$/i),
    accent: z.string().regex(/^#[a-f0-9]{6}$/i),
    keyring: z.boolean(),
  }),
  quantity: z.number().int().min(1).max(100000),
  material: z.enum(["soft", "velvet", "consult"]),
  purpose: z.enum(["sample", "production"]),
  notes: z.string().max(3000),
});
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "담당자 이름을 2자 이상 입력해 주세요.")
    .max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine(
      v => !v || /^[+\d() -]{7,30}$/.test(v),
      "전화번호 형식을 확인해 주세요."
    ),
  consent: z.literal(true),
});
export type CustomerDraft = z.infer<typeof customerDraftSchema>;
export type ReferenceFile = {
  id: string;
  label: string;
  file: File;
  url: string;
  position: string;
};
export type RequestRow = {
  product_snapshot?: import("@/atelier/project").Project | null;
  quote_amount_krw?: number | null;
  quote_lead_days?: number | null;
  quote_note?: string | null;
  quote_version?: number;
  id: string;
  created_at: string;
  status: string;
  design: CustomerDraft["design"];
  quantity: number;
  purpose: string;
  customer_name: string;
  contact_email: string;
  phone: string;
  notes: string;
  material: string;
  references: Array<{
    path: string;
    label: string;
    position: string;
    name: string;
  }>;
};
export const statusNames: Record<string, string> = {
  received: "접수 완료",
  reviewing: "제작 가능 여부 검토",
  quoted: "견적 안내",
  confirmed: "제작 확정",
  closed: "상담 종료",
};
export async function sendCustomerRequest(
  id: string,
  draft: CustomerDraft,
  contact: z.infer<typeof contactSchema>,
  files: ReferenceFile[]
) {
  if (!supabase)
    throw Error(
      "현재 온라인 접수를 준비 중입니다. 디자인을 저장하고 잠시 후 다시 이용해 주세요."
    );
  const valid = customerDraftSchema.parse(draft);
  const person = contactSchema.parse(contact);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email)
    throw Error("이메일 로그인 후 접수할 수 있습니다.");
  // Retry uses a stable id. If the response was lost after insertion, return the existing receipt.
  const { data: existing, error: readError } = await supabase
    .from("customer_requests")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (readError)
    throw Error(
      "접수 시스템에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
    );
  if (existing) return existing.id as string;
  const references = [];
  for (const item of files) {
    const path = `${user.id}/${id}/${item.id}`;
    const { error } = await supabase.storage
      .from("customer-references")
      .upload(path, item.file, { contentType: item.file.type, upsert: true });
    if (error)
      throw Error(
        "참고 이미지 전송에 실패했습니다. 이미지는 유지되며 다시 접수할 수 있습니다."
      );
    references.push({
      path,
      label: item.label,
      name: item.file.name,
      position: item.position,
    });
  }
  const { error } = await supabase.from("customer_requests").insert({
    id,
    customer_id: user.id,
    customer_name: person.name,
    contact_email: user.email,
    phone: person.phone,
    design: valid.design,
    quantity: valid.quantity,
    material: valid.material,
    purpose: valid.purpose,
    notes: valid.notes,
    references,
    consent_version: "request-v1",
  });
  if (error)
    throw Error(
      "접수 확인을 받지 못했습니다. 같은 버튼으로 다시 시도하면 중복 접수를 방지합니다."
    );
  return id;
}
