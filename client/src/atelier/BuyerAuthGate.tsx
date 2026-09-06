import { CheckCircle2, Mail, X } from "lucide-react";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  buyerAccessPrompt,
  type ProtectedArtifact,
  useBuyerSession,
} from "./buyerAccess";
import "./buyerAuth.css";

export function BuyerAuthGate({
  open,
  artifact,
  user,
  onClose,
  onMessage,
}: {
  open: boolean;
  artifact: ProtectedArtifact | null;
  user: User | null;
  onClose: () => void;
  onMessage: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const { sendMagicLink } = useBuyerSession();
  if (!open || !artifact) return null;

  return (
    <div className="at-auth-backdrop" role="presentation">
      <section
        aria-describedby="buyer-access-description"
        aria-labelledby="buyer-access-title"
        aria-modal="true"
        className="at-auth-gate"
        role="dialog"
      >
        <button aria-label="인증 창 닫기" className="at-auth-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        {user ? (
          <div className="at-auth-confirmed">
            <CheckCircle2 size={24} />
            <h2 id="buyer-access-title">이메일 인증이 완료됐습니다.</h2>
            <p id="buyer-access-description">{user.email} 계정으로 {artifact}을 계속할 수 있습니다.</p>
            <button className="at-primary" onClick={onClose} type="button">디자인으로 돌아가기</button>
          </div>
        ) : (
          <form
            onSubmit={event => {
              event.preventDefault();
              setBusy(true);
              void sendMagicLink(email)
                .then(() => {
                  onMessage("인증 링크를 이메일로 보냈습니다. 링크를 열면 현재 디자인으로 돌아옵니다.");
                })
                .catch(error => onMessage(error instanceof Error ? error.message : "인증을 시작하지 못했습니다."))
                .finally(() => setBusy(false));
            }}
          >
            <span className="at-auth-kicker">SAVE & DOWNLOAD</span>
            <h2 id="buyer-access-title">디자인을 보관할 준비가 됐나요?</h2>
            <p id="buyer-access-description">{buyerAccessPrompt(artifact)}</p>
            <label className="at-field" htmlFor="buyer-email">
              <span>업무용 이메일</span>
              <div className="at-auth-email-field">
                <Mail size={16} />
                <input
                  autoComplete="email"
                  id="buyer-email"
                  inputMode="email"
                  onChange={event => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </label>
            <p className="at-auth-note">비밀번호를 만들 필요가 없습니다. 이메일 링크로 인증하며, 체험 중인 3D 디자인은 이 브라우저에 남아 있습니다.</p>
            <button className="at-primary" disabled={busy} type="submit">
              {busy ? "인증 링크 보내는 중…" : "이메일 인증 링크 받기"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
