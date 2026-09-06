import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RequestRow } from "@/lib/customerRequest";
export function RequestQuote({
  row,
  staff = false,
  onChange,
}: {
  row: RequestRow;
  staff?: boolean;
  onChange?: () => void;
}) {
  const [amount, setAmount] = useState(String(row.quote_amount_krw ?? "")),
    [days, setDays] = useState(String(row.quote_lead_days ?? "")),
    [note, setNote] = useState(row.quote_note ?? ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [agreed, setAgreed] = useState(false);
  const call = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      if (staff) {
        if (
          !Number.isInteger(Number(amount)) ||
          Number(amount) < 1 ||
          !Number.isInteger(Number(days)) ||
          Number(days) < 1
        )
          throw Error("총액과 소요일을 양의 정수로 입력해 주세요.");
        const { error } = await supabase.rpc("offer_customer_quote", {
          p_request_id: row.id,
          p_amount_krw: Number(amount),
          p_lead_days: Number(days),
          p_note: note,
        });
        if (error) throw error;
        setMessage(
          "새 견적을 저장했습니다. 고객이 내 제작 요청에서 확인할 수 있습니다."
        );
      } else {
        const { error } = await supabase.rpc("accept_customer_quote", {
          p_request_id: row.id,
          p_quote_version: row.quote_version,
        });
        if (error) throw error;
        setMessage(
          "견적에 동의했습니다. 결제와 최종 제작 일정은 담당자와 확인하세요."
        );
      }
      onChange?.();
    } catch (e) {
      setMessage(
        e instanceof Error && e.message.includes("정수")
          ? e.message
          : "처리하지 못했습니다. 견적이 바뀌었을 수 있으니 최신 내역을 다시 열어 주세요."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="cs-quote-box">
      {staff ? (
        <>
          <h3>제작 견적 제시</h3>
          <label className="cs-field">
            <span>총 견적금액 (원 · 부가세 및 배송 포함 여부는 메모)</span>
            <input
              type="number"
              min="1"
              max="1000000000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </label>
          <label className="cs-field">
            <span>예상 소요일</span>
            <input
              type="number"
              min="1"
              max="730"
              value={days}
              onChange={e => setDays(e.target.value)}
            />
          </label>
          <label className="cs-field">
            <span>견적 조건 · 포함 항목</span>
            <textarea
              maxLength={2000}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>
          <button
            className="cs-primary"
            disabled={
              busy || row.status === "confirmed" || row.status === "closed"
            }
            onClick={call}
          >
            견적 제시
          </button>
        </>
      ) : row.quote_amount_krw ? (
        <>
          <h3>제작 견적 · 버전 {row.quote_version}</h3>
          <p>
            총액 {Number(row.quote_amount_krw).toLocaleString("ko-KR")}원 · 예상{" "}
            {row.quote_lead_days}일
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{row.quote_note}</p>
          {row.status === "quoted" && (
            <>
              <label className="cs-checkbox">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                />
                제시된 견적과 조건을 확인하고 제작 진행에 동의합니다. 결제는
                별도입니다.
              </label>
              <button
                className="cs-primary"
                disabled={busy || !agreed}
                onClick={call}
              >
                이 견적으로 제작 진행 동의
              </button>
            </>
          )}
          {row.status === "confirmed" && (
            <p>
              견적 동의가 완료되었습니다. 결제 처리 완료를 의미하지 않습니다.
            </p>
          )}
        </>
      ) : (
        <p>제작 검토 후 견적이 여기에 표시됩니다.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
