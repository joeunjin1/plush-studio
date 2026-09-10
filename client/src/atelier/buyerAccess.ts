import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ProtectedArtifact =
  | "클라우드 저장"
  | "제작 견적 요청"
  | "완성 미리보기 PNG"
  | "Design Proof 3면 PNG"
  | "부위 분리 GLB"
  | "Design Proof PDF"
  | "Design Proof JSON"
  | "전체 백업 JSON";

export function buyerEmailRedirectUrl(location: Location = window.location) {
  return `${location.origin}${location.pathname}${location.search}${location.hash}`;
}

const catalogAdminReturnParameter = "plush_admin_return";

export function catalogAdminMagicLinkRedirectUrl(location: Location = window.location) {
  const url = new URL(location.href);
  url.hash = "";
  url.searchParams.set(catalogAdminReturnParameter, "catalog-admin");
  return url.toString();
}

export function catalogAdminMagicLinkRestoreRoute(location: Location = window.location) {
  const url = new URL(location.href);
  if (url.searchParams.get(catalogAdminReturnParameter) !== "catalog-admin") return null;
  url.searchParams.delete(catalogAdminReturnParameter);
  return `${url.pathname}${url.search}#catalog-admin`;
}

export function buyerAccessPrompt(artifact: ProtectedArtifact) {
  return `${artifact}은 이메일 인증 후 이용할 수 있습니다. 지금까지의 체험 디자인은 이 기기에 유지됩니다.`;
}

const buyerDownloadArtifactTypes = {
  "완성 미리보기 PNG": "preview_png",
  "Design Proof 3면 PNG": "proof_png_3view",
  "부위 분리 GLB": "parted_glb",
  "Design Proof PDF": "proof_pdf",
  "Design Proof JSON": "proof_json",
  "전체 백업 JSON": "full_backup_json",
} as const;

export function buyerDownloadArtifactType(
  artifact: Exclude<ProtectedArtifact, "클라우드 저장" | "제작 견적 요청">
) {
  return buyerDownloadArtifactTypes[artifact];
}

export const buyerDownloadAuditFailureMessage =
  "파일은 저장됐지만 다운로드 기록을 남기지 못했습니다.";

export function buyerMagicLinkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("rate limit") || message.includes("too many requests"))
    return "인증 메일 발송 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.";
  if (message.includes("redirect") || message.includes("url is not allowed"))
    return "현재 Preview 주소가 인증 복귀 URL로 허용되지 않았습니다. 관리자에게 알려주세요.";
  if (message.includes("email") || message.includes("smtp"))
    return "인증 메일 서비스를 사용할 수 없습니다. 관리자에게 이메일 발송 설정을 확인해 달라고 요청해 주세요.";
  return "로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function completeBuyerDownloadAudit(
  record: () => Promise<void>
) {
  try {
    await record();
    return { recorded: true as const };
  } catch {
    return { recorded: false as const, message: buyerDownloadAuditFailureMessage };
  }
}

export async function recordBuyerDownload(
  artifact: Exclude<ProtectedArtifact, "클라우드 저장" | "제작 견적 요청">,
  projectId: string,
  revision: number
) {
  if (!supabase) throw Error("다운로드 기록 연결을 준비하지 못했습니다.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Error("다운로드 기록을 남기려면 이메일 로그인이 필요합니다.");
  const { error } = await supabase
    .from("buyer_download_events")
    .insert({
      user_id: user.id,
      project_id: projectId,
      project_revision: revision,
      artifact_type: buyerDownloadArtifactType(artifact),
    });
  if (error) throw Error("다운로드 기록을 남기지 못했습니다.");
}

export function useBuyerSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user ?? null);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = async (email: string) => {
    if (!supabase) throw Error("온라인 인증 연결을 준비 중입니다.");
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw Error("이메일 주소를 확인해 주세요.");
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: buyerEmailRedirectUrl() },
    });
    if (error) throw Error(buyerMagicLinkErrorMessage(error));
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw Error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
  };

  return { user, loading, sendMagicLink, signOut };
}
