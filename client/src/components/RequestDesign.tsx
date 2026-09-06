import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { hydrate } from "@/atelier/storage";
import { parseProject, productNames, type Project } from "@/atelier/project";
import { saveBlob } from "@/atelier/ProductPreview";
export function RequestDesign({
  snapshot,
  requestId,
}: {
  snapshot?: Project | null;
  requestId: string;
}) {
  const [message, setMessage] = useState(""),
    [events, setEvents] = useState<
      Array<{ new_status: string; created_at: string }>
    >([]),
    [busy, setBusy] = useState(false);
  return (
    <div className="request-design">
      {snapshot && (
        <>
          <p>
            {productNames[snapshot.product]} · {snapshot.width} ×{" "}
            {snapshot.height} × {snapshot.depth}cm · 접수 버전{" "}
            {snapshot.revision}
          </p>
          <p>
            부위 {snapshot.parts.length}개 · 디자인 {snapshot.decals.length}개 ·
            이미지 {snapshot.assets.length}개
          </p>
          <button
            className="cs-secondary"
            disabled={busy}
            onClick={() => {
              try {
                (
                  window as Window & { atelierSnapshot?: Project }
                ).atelierSnapshot = parseProject(snapshot);
                window.location.hash = "#atelier";
                window.dispatchEvent(new Event("atelier-open-snapshot"));
              } catch {
                setMessage("디자인 정보를 읽지 못했습니다.");
              }
            }}
          >
            접수 디자인 다시 열기
          </button>
          <button
            className="cs-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const p = await hydrate(snapshot);
                saveBlob(
                  new Blob([JSON.stringify(p)], { type: "application/json" }),
                  `${p.name}-request-backup.json`
                );
              } catch {
                setMessage(
                  "이미지를 복구하지 못했습니다. 권한과 연결을 확인해 주세요."
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            접수 파일 전체 다운로드
          </button>
        </>
      )}
      <button
        className="cs-secondary"
        onClick={async () => {
          if (!supabase) return;
          const { data, error } = await supabase
            .from("customer_request_events")
            .select("new_status,created_at")
            .eq("request_id", requestId)
            .order("created_at", { ascending: false })
            .limit(30);
          if (error) setMessage("진행 이력을 불러오지 못했습니다.");
          else {
            setEvents(data ?? []);
            setMessage(data?.length ? "" : "기록된 변경 이력이 없습니다.");
          }
        }}
      >
        진행 이력 보기
      </button>
      {events.map((e, i) => (
        <p key={i}>
          {new Date(e.created_at).toLocaleString("ko-KR")} ·{" "}
          {(
            {
              received: "접수 완료",
              reviewing: "검토 중",
              quoted: "견적 제시",
              confirmed: "고객 동의 · 제작 확정",
              closed: "상담 종료",
            } as Record<string, string>
          )[e.new_status] ?? e.new_status}
        </p>
      ))}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
