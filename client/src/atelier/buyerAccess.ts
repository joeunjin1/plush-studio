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

export function buyerAccessPrompt(artifact: ProtectedArtifact) {
  return `${artifact}은 이메일 인증 후 이용할 수 있습니다. 지금까지의 체험 디자인은 이 기기에 유지됩니다.`;
}

export async function recordBuyerDownload(
  artifact: Exclude<ProtectedArtifact, "클라우드 저장" | "제작 견적 요청">,
  projectId: string,
  revision: number
) {
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const types = {
    "완성 미리보기 PNG": "preview_png",
    "Design Proof 3면 PNG": "proof_png_3view",
    "부위 분리 GLB": "parted_glb",
    "Design Proof PDF": "proof_pdf",
    "Design Proof JSON": "proof_json",
    "전체 백업 JSON": "full_backup_json",
  } as const;
  await supabase
    .from("buyer_download_events")
    .insert({
      user_id: user.id,
      project_id: projectId,
      project_revision: revision,
      artifact_type: types[artifact],
    });
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
    if (error) throw Error("로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw Error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
  };

  return { user, loading, sendMagicLink, signOut };
}
