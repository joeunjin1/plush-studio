import { RequestDesign } from "./RequestDesign";
import { RequestQuote } from "./RequestQuote";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { statusNames, transitionCustomerRequest, type RequestRow } from "@/lib/customerRequest";
import { nextRequestStages, type RequestStage } from "@/lib/requestLifecycle";
export function RequestInbox({ user }: { user: User | null }) {
  const [allowed, setAllowed] = useState(false),
    [checked, setChecked] = useState(false),
    [rows, setRows] = useState<RequestRow[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [page, setPage] = useState(0),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setAllowed(false);
    setChecked(false);
    setRows([]);
    if (!supabase || !user) {
      setChecked(true);
      return;
    }
    supabase
      .from("customer_request_staff")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active) {
          setAllowed(!!data && !error);
          setChecked(true);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    let active = true;
    if (!allowed || !supabase) return;
    setMessage("요청을 불러오는 중…");
    supabase
      .from("customer_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * 30, page * 30 + 29)
      .then(({ data, error }) => {
        if (active) {
          setRows(error ? [] : (data ?? []));
          setMessage(error ? "요청을 불러오지 못했습니다." : "");
        }
      });
    return () => {
      active = false;
    };
  }, [allowed, page, reload]);
  if (!checked) return <p>접근 권한 확인 중…</p>;
  if (!allowed)
    return (
      <p>운영자로 등록된 계정으로 로그인해야 접수 내역을 볼 수 있습니다.</p>
    );
  return (
    <section className="cs-request-page">
      <h1>제작 요청 관리</h1>
      <p>
        고객에게 견적을 안내하고 진행 상태를 기록하세요. 자동 이메일은 발송되지
        않습니다.
      </p>
      <button className="cs-secondary" onClick={() => setReload(r => r + 1)}>
        새로고침
      </button>
      <p role="status">{message}</p>
      {rows.map(row => (
        <article className="cs-inbox-card" key={row.id}>
          <header>
            <h2>{row.design.name}</h2>
            <span>{new Date(row.created_at).toLocaleString("ko-KR")}</span>
          </header>
          <p>
            {row.customer_name} · {row.contact_email} ·{" "}
            {row.phone || "전화번호 없음"}
          </p>
          <p>
            {row.product_snapshot?.height ?? row.design.heightCm}cm ·{" "}
            {row.quantity}개 · {row.material} ·{" "}
            {row.purpose === "sample" ? "샘플 먼저" : "수량 제작 견적"}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {row.notes || "추가 요청 없음"}
          </p>
          <small>접수번호 {row.id}</small>
          <RequestDesign snapshot={row.product_snapshot} requestId={row.id} />
          <RequestQuote
            row={row}
            staff
            onChange={() => setReload(r => r + 1)}
          />
          <div className="cs-field">
            <span>진행 상태 · {statusNames[row.status] ?? row.status}</span>
            {nextRequestStages(row.status).length ? (
              <div className="cs-form-actions">
                {nextRequestStages(row.status).map(status => (
                  <button
                    className="cs-secondary"
                    disabled={busy === row.id}
                    key={status}
                    onClick={async () => {
                      setBusy(row.id);
                      try {
                        await transitionCustomerRequest(row.id, status as RequestStage);
                        setRows(rows => rows.map(item => item.id === row.id ? { ...item, status } : item));
                        setMessage(`${statusNames[status]} 단계로 저장했습니다.`);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "상태 변경에 실패했습니다.");
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {statusNames[status]}로 이동
                  </button>
                ))}
              </div>
            ) : <p>이 요청은 종료된 상태입니다.</p>}
          </div>
          <details>
            <summary>디자인 설정 · 참고 이미지</summary>
            <pre>{JSON.stringify(row.design, null, 2)}</pre>
            {row.references.map(file => (
              <div key={file.path}>
                <p>
                  {file.label} · {file.position || "위치 설명 없음"}
                </p>
                <button
                  className="cs-secondary"
                  onClick={async () => {
                    const { data, error } = await supabase!.storage
                      .from("customer-references")
                      .download(file.path);
                    if (error) {
                      setMessage("이미지를 열지 못했습니다.");
                      return;
                    }
                    const url = URL.createObjectURL(data);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = file.name;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  이미지 다운로드 · {file.name}
                </button>
              </div>
            ))}
          </details>
        </article>
      ))}
      {rows.length === 0 && <p>이 페이지에 접수된 요청이 없습니다.</p>}
      <div className="cs-form-actions">
        <button
          className="cs-secondary"
          disabled={page === 0}
          onClick={() => setPage(p => p - 1)}
        >
          이전
        </button>
        <span>{page + 1} 페이지</span>
        <button
          className="cs-secondary"
          disabled={rows.length < 30}
          onClick={() => setPage(p => p + 1)}
        >
          다음
        </button>
      </div>
    </section>
  );
}
