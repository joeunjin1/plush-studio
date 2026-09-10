import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CalendarDays, PackageCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ReferenceOrderRow = {
  id: string;
  reference_product_title: string;
  reference_product_sku: string;
  reference_product_version: string;
  model_version: string | null;
  personalization_label: string;
  placement_label: string;
  quantity: number;
  desired_delivery_date: string | null;
  purpose: "sample" | "production" | "consult";
  status: "received" | "reviewing" | "quoted" | "confirmed" | "sample_review" | "production_qa" | "completed" | "closed";
  created_at: string;
};

const orderColumns = [
  "id",
  "reference_product_title",
  "reference_product_sku",
  "reference_product_version",
  "model_version",
  "personalization_label",
  "placement_label",
  "quantity",
  "desired_delivery_date",
  "purpose",
  "status",
  "created_at",
].join(",");

const statusLabel: Record<ReferenceOrderRow["status"], string> = {
  received: "검토 요청 접수",
  reviewing: "사양 검토 중",
  quoted: "견적 안내",
  confirmed: "제작 확인",
  sample_review: "샘플 검토",
  production_qa: "생산 품질 확인",
  completed: "진행 완료",
  closed: "종료",
};

const purposeLabel: Record<ReferenceOrderRow["purpose"], string> = {
  sample: "샘플 상담",
  production: "수량 제작",
  consult: "상담 요청",
};

export function ReferenceProductOrderHistory({ user }: { user: User | null }) {
  const [rows, setRows] = useState<ReferenceOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setRows([]);
    setError(false);
    if (!user || !supabase) return () => {
      active = false;
    };

    setLoading(true);
    supabase
      .from("reference_product_order_requests")
      .select(orderColumns)
      .not("status", "in", "(completed,closed)")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setRows(queryError ? [] : ((data ?? []) as unknown as ReferenceOrderRow[]));
        setError(Boolean(queryError));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (!user) return null;

  return (
    <section className="cs-reference-order-history" aria-labelledby="reference-order-history-title">
      <div className="cs-reference-order-history-heading">
        <div>
          <p className="cs-kicker">OFFICIAL PRODUCT REQUESTS</p>
          <h2 id="reference-order-history-title">공식 상품 제작 요청</h2>
          <p>결제 전 사양 검토 요청만 표시합니다. 제작 확정·운송 일정은 운영자 검토 후 갱신됩니다.</p>
        </div>
        <a className="cs-secondary" href="#atelier">공식 상품 더 보기</a>
      </div>

      {loading ? (
        <p className="cs-reference-order-note" role="status">공식 상품 요청을 불러오는 중…</p>
      ) : error ? (
        <p className="cs-reference-order-note" role="alert">공식 상품 요청을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
      ) : rows.length === 0 ? (
        <p className="cs-reference-order-note">진행 중인 공식 상품 제작 요청이 없습니다.</p>
      ) : (
        <div className="cs-reference-order-list">
          {rows.map(row => (
            <article className="cs-reference-order-card" key={row.id}>
              <PackageCheck aria-hidden="true" size={24} />
              <div>
                <span className="cs-tag">{statusLabel[row.status]}</span>
                <h3>{row.reference_product_title}</h3>
                <p>{row.personalization_label} · {row.placement_label || "적용 위치 검토"}</p>
                <small>{row.reference_product_sku} · 상품 v{row.reference_product_version.replace(/^v/, "")} · 3D {row.model_version ?? "미등록"}</small>
              </div>
              <dl>
                <div><dt>수량</dt><dd>{row.quantity.toLocaleString()}개</dd></div>
                <div><dt>요청 목적</dt><dd>{purposeLabel[row.purpose]}</dd></div>
                <div><dt><CalendarDays aria-hidden="true" size={13} /> 희망 납기</dt><dd>{row.desired_delivery_date ?? "미입력"}</dd></div>
              </dl>
              <small className="cs-reference-order-id">요청번호 {row.id}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
