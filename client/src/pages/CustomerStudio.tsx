import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  ImagePlus,
  Package,
  Rotate3D,
  Sparkles,
  X,
} from "lucide-react";
import { ThreeDesigner } from "@/components/ThreeDesigner";
import { PlushIllustration } from "@/components/PlushIllustration";
import { initialDesign, type DesignState } from "@/lib/studioTypes";
import { supabase } from "@/lib/supabase";
import {
  customerDraftSchema,
  contactSchema,
  sendCustomerRequest,
  statusNames,
  type CustomerDraft,
  type ReferenceFile,
  type RequestRow,
} from "@/lib/customerRequest";
import { newRequestId } from "@/lib/requestId";
import { RequestDesign } from "@/components/RequestDesign";
import { RequestQuote } from "@/components/RequestQuote";
import { RequestInbox } from "@/components/RequestInbox";
import { ReferenceProductOrderHistory } from "@/components/ReferenceProductOrderHistory";
import { catalogAdminMagicLinkRestoreRoute } from "@/atelier/buyerAccess";
import "./customer.css";
const Atelier = lazy(() => import("@/atelier/Atelier"));
const CatalogModelAdmin = lazy(() => import("@/atelier/CatalogModelAdmin"));
const Workspace = lazy(() => import("./Home"));
const defaults: CustomerDraft = {
  design: { ...initialDesign, name: "나만의 인형", color: "#c49378" },
  quantity: 100,
  material: "soft",
  purpose: "sample",
  notes: "",
};
const kinds = [
  ["bear", "포근한 곰", "동글동글, 친근한 매력"],
  ["rabbit", "다정한 토끼", "긴 귀가 사랑스러운 친구"],
  ["cat", "느긋한 고양이", "뾰족한 귀, 특별한 개성"],
] as const;
const materials = {
  soft: "부드러운 숏파일",
  velvet: "매끈한 벨벳",
  consult: "상담 후 결정",
};
function loadDraft() {
  try {
    const raw = localStorage.getItem("plush-customer-draft");
    if (raw) {
      const parsed = customerDraftSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {}
  return defaults;
}
function Field({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label className="cs-field">
      <span>{title}</span>
      {children}
    </label>
  );
}
function Auth({
  user,
  setMessage,
}: {
  user: User | null;
  setMessage: (s: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false);
  if (user)
    return (
      <div className="cs-auth">
        <CheckCircle2 size={18} />
        <span>
          {user.email}
          <small>이 이메일로 제작 상담을 진행합니다.</small>
        </span>
        <button
          type="button"
          onClick={async () => {
            const r = await supabase?.auth.signOut();
            if (r?.error)
              setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
          }}
        >
          로그아웃
        </button>
      </div>
    );
  return (
    <form
      className="cs-auth-form"
      onSubmit={async e => {
        e.preventDefault();
        if (!supabase) return;
        setBusy(true);
        try {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin },
          });
          setMessage(
            error
              ? "로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."
              : "로그인 링크를 보냈습니다. 이메일에서 링크를 열어 주세요. 디자인 설정은 이 브라우저에 보관됩니다."
          );
        } catch {
          setMessage("네트워크 연결을 확인해 주세요.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>이메일로 간편하게 시작하세요</h3>
      <p>
        디자인은 로그인 없이 만들 수 있어요. 접수와 조회에는 로그인이
        필요합니다.
      </p>
      <Field title="이메일">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
      </Field>
      <button className="cs-primary" disabled={busy || !supabase}>
        {busy ? "보내는 중…" : "로그인 링크 받기"}
      </button>
      {!supabase && (
        <p>온라인 접수를 준비 중입니다. 디자인 파일은 저장할 수 있습니다.</p>
      )}
    </form>
  );
}
export default function CustomerStudio() {
  const [draft, setDraft] = useState<CustomerDraft>(loadDraft),
    [step, setStep] = useState(0),
    [screen, setScreen] = useState("design"),
    [user, setUser] = useState<User | null>(null),
    [refs, setRefs] = useState<ReferenceFile[]>([]),
    [message, setMessage] = useState(""),
    [contact, setContact] = useState({ name: "", phone: "", consent: false }),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(""),
    [rows, setRows] = useState<RequestRow[]>([]),
    [requestReload, setRequestReload] = useState(0),
    [loading, setLoading] = useState(false),
    [view, setView] = useState<"perspective" | "front" | "side" | "back">(
      "perspective"
    );
  const requestId = useRef(newRequestId());
  const urls = useRef(new Set<string>());
  const listSerial = useRef(0);
  const submissionLock = useRef(false);
  useEffect(() => {
    const onHash = () =>
      setScreen(
        window.location.hash === "#catalog-admin"
          ? "catalog-admin"
          : window.location.hash === "#atelier"
          ? "atelier"
          : window.location.hash === "#inbox"
            ? "inbox"
            : window.location.hash === "#workspace"
              ? "workspace"
              : window.location.hash === "#requests"
                ? "requests"
                : "design"
      );
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const applySession = (session: Session | null) => {
      setUser(session?.user ?? null);
      if (!session?.user) return;
      const adminRestoreRoute = catalogAdminMagicLinkRestoreRoute();
      if (!adminRestoreRoute) return;
      window.history.replaceState(null, "", adminRestoreRoute);
      setScreen("catalog-admin");
    };
    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      applySession(session)
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("plush-customer-draft", JSON.stringify(draft));
    } catch {
      setMessage(
        "자동 저장 공간이 부족합니다. 디자인 파일을 내려받아 보관해 주세요."
      );
    }
  }, [draft]);
  useEffect(
    () => () => urls.current.forEach(url => URL.revokeObjectURL(url)),
    []
  );
  useEffect(() => {
    setRows([]);
    if (screen !== "requests" || !user || !supabase) return;
    let active = true;
    const serial = ++listSerial.current;
    setLoading(true);
    supabase
      .from("customer_requests")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (active && serial === listSerial.current) {
          setRows(error ? [] : (data ?? []));
          setMessage(
            error
              ? "요청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
              : ""
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [screen, user, requestReload]);
  const edit = (patch: Partial<CustomerDraft>) => {
    setDraft(d => ({ ...d, ...patch }));
    requestId.current = newRequestId();
  };
  const design = (patch: Partial<DesignState>) =>
    edit({ design: { ...draft.design, ...patch } });
  const move = (next: number) => {
    setStep(next);
    setMessage("");
    document.getElementById("cs-step-title")?.focus();
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "plush-design.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "디자인 설정을 저장했습니다. 참고 이미지는 원본 파일을 함께 보관해 주세요."
    );
  };
  const attach = async (file: File | undefined, label: string) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage("PNG, JPG, WebP 이미지를 5MB 이하로 올려 주세요.");
      return;
    }
    if (refs.length >= 6) {
      setMessage("참고 이미지는 최대 6장까지 올릴 수 있습니다.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (img.width * img.height > 40000000) reject();
          else resolve();
        };
        img.onerror = reject;
        img.src = url;
      });
      urls.current.add(url);
      setRefs(r => [
        ...r,
        { id: newRequestId(), label, file, url, position: "" },
      ]);
      requestId.current = newRequestId();
      setMessage("이미지를 추가했습니다. 위치와 설명을 적어 주세요.");
    } catch {
      URL.revokeObjectURL(url);
      setMessage("읽을 수 없는 이미지입니다. 다른 파일을 선택해 주세요.");
    }
  };
  const submit = async () => {
    if (submissionLock.current) return;
    if (!customerDraftSchema.safeParse(draft).success) {
      setMessage(
        "인형 이름과 수량을 확인해 주세요. 수량은 1~100,000개의 정수여야 합니다."
      );
      return;
    }
    const parsed = contactSchema.safeParse(contact);
    if (!parsed.success) {
      setMessage(
        contact.consent
          ? parsed.error.issues[0].message
          : "상담 정보 전달에 동의해 주세요."
      );
      return;
    }
    submissionLock.current = true;
    setBusy(true);
    setMessage("이미지와 제작 요청을 전송하고 있습니다…");
    try {
      const id = await sendCustomerRequest(
        requestId.current,
        draft,
        parsed.data,
        refs
      );
      setReceipt(id);
      setMessage("");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "접수에 실패했습니다. 다시 시도해 주세요."
      );
    } finally {
      setBusy(false);
      submissionLock.current = false;
    }
  };
  const header = (
    <header className="cs-header">
      <a className="cs-logo" href="#design">
        <span>
          <Sparkles size={21} />
        </span>
        plush studio<span className="cs-logo-dot">®</span>
      </a>
      <nav aria-label="주 메뉴">
        <a href="#atelier">삼면도 · 가방 · 티셔츠</a>
        <a
          href="#design"
          aria-current={screen === "design" ? "page" : undefined}
        >
          인형 만들기
        </a>
        <a
          href="#requests"
          aria-current={screen === "requests" ? "page" : undefined}
        >
          내 제작 요청
        </a>
        <a href="#workspace" className="cs-workspace-link">
          제조 작업실 ↗
        </a>
      </nav>
    </header>
  );
  if (screen === "atelier")
    return (
      <Suspense fallback={<p>제품 편집기를 여는 중…</p>}>
        <Atelier />
      </Suspense>
    );
  if (screen === "catalog-admin")
    return (
      <Suspense fallback={<p>관리자 상품 마스터를 여는 중…</p>}>
        <CatalogModelAdmin user={user} />
      </Suspense>
    );
  if (screen === "workspace")
    return (
      <>
        <div className="cs-workspace-banner">
          <a href="#design">← 고객 화면으로</a>
          <a href="#inbox">고객 제작 요청 관리 →</a>
        </div>
        <Suspense fallback={<p>작업실을 여는 중…</p>}>
          <Workspace />
        </Suspense>
      </>
    );
  return (
    <div className="customer-studio">
      {header}
      <main className="cs-main">
        {screen === "inbox" ? (
          <>
            <Auth user={user} setMessage={setMessage} />
            <RequestInbox user={user} />
          </>
        ) : screen === "requests" ? (
          <section className="cs-request-page">
            <p className="cs-kicker">MY REQUESTS</p>
            <h1>내 제작 요청</h1>
            <p>
              공식 상품과 직접 만든 디자인의 제작 검토 요청을 구분해 확인하세요.
              결제·발주 확정 전 요청과 진행 상태만 보여드립니다.
            </p>
            <Auth user={user} setMessage={setMessage} />
            <ReferenceProductOrderHistory user={user} />
            <section className="cs-generic-request-history" aria-labelledby="generic-request-history-title">
              <div className="cs-reference-order-history-heading">
                <div>
                  <p className="cs-kicker">CUSTOM 3D DESIGN REQUESTS</p>
                  <h2 id="generic-request-history-title">직접 만든 3D 디자인 요청</h2>
                </div>
              </div>
            {loading ? (
              <p role="status">내역을 불러오는 중…</p>
            ) : user && rows.length === 0 ? (
              <div className="cs-empty">
                <Package size={38} />
                <h3>아직 접수한 3D 디자인 요청이 없어요</h3>
                <a className="cs-primary" href="#design">
                  첫 인형 만들기 <ArrowRight size={18} />
                </a>
              </div>
            ) : (
              rows.map(r => (
                <article className="cs-request-card" key={r.id}>
                  {!r.product_snapshot && (
                    <PlushIllustration design={r.design} compact />
                  )}
                  <div>
                    <span className="cs-tag">
                      {statusNames[r.status] ?? r.status}
                    </span>
                    <h2>{r.design.name}</h2>
                    <p>
                      {r.product_snapshot?.height ?? r.design.heightCm}cm ·{" "}
                      {r.quantity.toLocaleString()}개 ·{" "}
                      {r.purpose === "sample" ? "샘플 먼저" : "수량 제작 상담"}
                    </p>
                    <small>
                      {new Date(r.created_at).toLocaleDateString("ko-KR")} ·
                      접수번호 {r.id}
                    </small>
                    <details>
                      <summary>요청 내용 보기</summary>
                      <RequestDesign
                        snapshot={r.product_snapshot}
                        requestId={r.id}
                      />
                      <RequestQuote
                        row={r}
                        onChange={() => setRequestReload(v => v + 1)}
                      />
                      <p>{r.notes || "추가 요청 없음"}</p>
                      {r.references?.map(f => (
                        <p key={f.path}>
                          {f.label} · {f.name} · {f.position || "위치 미지정"}
                        </p>
                      ))}
                    </details>
                  </div>
                </article>
              ))
            )}
            </section>
          </section>
        ) : receipt ? (
          <section className="cs-success">
            <CheckCircle2 size={56} />
            <p className="cs-kicker">REQUEST RECEIVED</p>
            <h1>인형의 첫걸음이 시작됐어요.</h1>
            <p>
              제작 요청이 접수되었습니다. 제작 가능 여부와 견적을 검토한 후
              <br />
              로그인한 이메일로 상담을 진행합니다.
            </p>
            <div className="cs-receipt">
              <span>접수번호</span>
              <strong>{receipt}</strong>
            </div>
            <p>아직 결제나 발주가 확정된 단계는 아닙니다.</p>
            <a href="#requests" className="cs-primary">
              내 요청 확인 <ArrowRight size={18} />
            </a>
            <button
              className="cs-secondary"
              onClick={() => {
                setReceipt("");
                setStep(0);
                requestId.current = newRequestId();
              }}
            >
              디자인 계속하기
            </button>
          </section>
        ) : (
          <>
            <div className="cs-intro">
              <div>
                <p className="cs-kicker">YOUR IDEA, A LITTLE SOFTER.</p>
                <h1>
                  상상 속 친구를,
                  <br />
                  <em>내 손안의 인형으로.</em>
                </h1>
                <p>
                  모양을 고르고, 나만의 디테일을 더하세요.
                  <br className="cs-mobile-break" /> 제작 상담까지 한곳에서
                  시작할 수 있어요.
                </p>
              </div>
              <div className="cs-intro-note">
                <span>작은 아이디어부터</span>
                <b>나만의 캐릭터 · 브랜드 굿즈 · 선물</b>
                <span>디자인과 수량에 맞춰 개별 견적 안내</span>
              </div>
            </div>
            <nav className="cs-steps" aria-label="인형 제작 단계">
              {["기본형 선택", "나만의 디자인", "제작 옵션", "확인 · 접수"].map(
                (label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-current={step === i ? "step" : undefined}
                    onClick={() => move(i)}
                  >
                    <span>
                      {step > i ? (
                        <Check size={15} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    {label}
                  </button>
                )
              )}
            </nav>
            <div className="cs-editor">
              <fieldset disabled={busy} className="cs-form-panel">
                <div className="cs-section-heading">
                  <p className="cs-kicker">STEP 0{step + 1}</p>
                  <h2 id="cs-step-title" tabIndex={-1}>
                    {
                      [
                        "어떤 친구를 만들까요?",
                        "작은 차이가, 나만의 개성이 돼요.",
                        "어떤 인형으로 제작할까요?",
                        "마지막으로 확인해 주세요.",
                      ][step]
                    }
                  </h2>
                  <p>
                    {
                      [
                        "마음에 드는 기본형을 선택하세요. 다음 단계에서 바꿀 수 있어요.",
                        "색상과 비율을 조정하고 참고 이미지로 디테일을 알려 주세요.",
                        "정확한 가격과 제작 일정은 디자인 검토 후 안내합니다.",
                        "접수 내용을 확인하고 이메일로 제작 상담을 시작하세요.",
                      ][step]
                    }
                  </p>
                </div>
                {step === 0 && (
                  <>
                    <div className="cs-kinds">
                      {kinds.map(([kind, label, desc]) => (
                        <button
                          className={`cs-kind ${draft.design.kind === kind ? "selected" : ""}`}
                          aria-pressed={draft.design.kind === kind}
                          key={kind}
                          onClick={() => design({ kind })}
                        >
                          <span className="cs-kind-check">
                            {draft.design.kind === kind && <Check size={14} />}
                          </span>
                          <PlushIllustration
                            design={{ ...defaults.design, kind }}
                            compact
                          />
                          <b>{label}</b>
                          <small>{desc}</small>
                        </button>
                      ))}
                    </div>
                    <div className="cs-hint">
                      <ImagePlus size={20} />
                      <div>
                        <strong>이미 그려 둔 캐릭터가 있나요?</strong>
                        <p>
                          다음 단계에서 정면·옆면·뒷면과 추가 부위 이미지를 올려
                          주세요. 제작 검토용 참고 자료로 전달됩니다.
                        </p>
                      </div>
                    </div>
                    <Field title="인형 이름">
                      <input
                        maxLength={100}
                        value={draft.design.name}
                        onChange={e => design({ name: e.target.value })}
                        placeholder="예: 구름이"
                      />
                    </Field>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="cs-two">
                      <Field title="본체 색상">
                        <div className="cs-color">
                          <input
                            type="color"
                            value={draft.design.color}
                            onChange={e => design({ color: e.target.value })}
                          />
                          <span>{draft.design.color.toUpperCase()}</span>
                        </div>
                      </Field>
                      <Field title="포인트 색상">
                        <div className="cs-color">
                          <input
                            type="color"
                            value={draft.design.accent}
                            onChange={e => design({ accent: e.target.value })}
                          />
                          <span>{draft.design.accent.toUpperCase()}</span>
                        </div>
                      </Field>
                    </div>
                    <div className="cs-swatches">
                      {[
                        "#c49378",
                        "#e1c3a8",
                        "#e8b9c7",
                        "#a9c4b5",
                        "#b7b6d8",
                        "#f0dfa9",
                      ].map(color => (
                        <button
                          key={color}
                          style={{ background: color }}
                          aria-label={`본체 색상 ${color}`}
                          aria-pressed={draft.design.color === color}
                          onClick={() => design({ color })}
                        >
                          {draft.design.color === color && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                    <details className="cs-details">
                      <summary>비율 세밀하게 조정하기</summary>
                      {(
                        [
                          ["headScale", "머리 크기", 0.7, 1.3],
                          ["bodyScale", "몸통 크기", 0.7, 1.3],
                          ["earScale", "귀 길이", 0.5, 2],
                        ] as const
                      ).map(([key, label, min, max]) => (
                        <Field
                          key={key}
                          title={`${label} · ${draft.design[key].toFixed(2)}배`}
                        >
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={0.05}
                            value={draft.design[key]}
                            onChange={e =>
                              design({ [key]: Number(e.target.value) })
                            }
                          />
                        </Field>
                      ))}
                    </details>
                    <div className="cs-subtitle">
                      <h3>
                        참고 이미지 <small>선택</small>
                      </h3>
                      <p>최대 6장 · JPG, PNG, WebP · 장당 5MB 이하</p>
                    </div>
                    <div className="cs-uploads">
                      {["정면", "옆면", "뒷면", "추가 부위"].map(label => (
                        <label key={label} className="cs-upload">
                          <ImagePlus size={23} />
                          <b>{label}</b>
                          <span>이미지 추가</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            aria-label={`${label} 이미지 추가`}
                            onChange={e => {
                              void attach(e.target.files?.[0], label);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    {refs.map(item => (
                      <div className="cs-reference" key={item.id}>
                        <img src={item.url} alt={`${item.label} 참고 이미지`} />
                        <div>
                          <b>{item.label}</b>
                          <Field title="부위 위치 · 수정 내용">
                            <input
                              maxLength={200}
                              value={item.position}
                              onChange={e => {
                                setRefs(r =>
                                  r.map(f =>
                                    f.id === item.id
                                      ? { ...f, position: e.target.value }
                                      : f
                                  )
                                );
                                requestId.current = newRequestId();
                              }}
                              placeholder="예: 머리 위 왼쪽, 분리 가능한 리본"
                            />
                          </Field>
                        </div>
                        <button
                          aria-label={`${item.label} 이미지 제거`}
                          onClick={() => {
                            URL.revokeObjectURL(item.url);
                            urls.current.delete(item.url);
                            setRefs(r => r.filter(f => f.id !== item.id));
                            requestId.current = newRequestId();
                          }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                    <p className="cs-muted">
                      이미지는 자동 3D 변환되지 않습니다. 제작자가 형태와 부위
                      위치를 검토하는 자료입니다. 새로고침하면 이미지는 다시
                      첨부해 주세요.
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="cs-field">
                      <span id="height-label">
                        완성 높이 · {draft.design.heightCm}cm
                      </span>
                      <div className="cs-sizes">
                        {[10, 15, 20, 30].map(heightCm => (
                          <button
                            key={heightCm}
                            className={
                              draft.design.heightCm === heightCm
                                ? "selected"
                                : ""
                            }
                            onClick={() => design({ heightCm })}
                          >
                            {heightCm}cm
                          </button>
                        ))}
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={100}
                        step={1}
                        aria-labelledby="height-label"
                        value={draft.design.heightCm}
                        onChange={e =>
                          design({ heightCm: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="cs-two">
                      <Field title="희망 수량 (개)">
                        <input
                          type="number"
                          min={1}
                          max={100000}
                          step={1}
                          value={draft.quantity}
                          onChange={e =>
                            edit({ quantity: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field title="원단">
                        <select
                          value={draft.material}
                          onChange={e =>
                            edit({
                              material: e.target
                                .value as CustomerDraft["material"],
                            })
                          }
                        >
                          {Object.entries(materials).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field title="제작 진행 방식">
                      <select
                        value={draft.purpose}
                        onChange={e =>
                          edit({
                            purpose: e.target.value as CustomerDraft["purpose"],
                          })
                        }
                      >
                        <option value="sample">
                          샘플을 먼저 확인하고 싶어요
                        </option>
                        <option value="production">
                          수량 제작 견적을 받고 싶어요
                        </option>
                      </select>
                    </Field>
                    <label className="cs-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.design.keyring}
                        onChange={e => design({ keyring: e.target.checked })}
                      />
                      <span>
                        <strong>키링 고리 추가</strong>
                        <small>가방에 달 수 있는 고리를 포함해 주세요.</small>
                      </span>
                    </label>
                    <Field title="추가 요청 · 희망 일정 (선택)">
                      <textarea
                        rows={4}
                        maxLength={3000}
                        value={draft.notes}
                        onChange={e => edit({ notes: e.target.value })}
                        placeholder="예: 배에 로고 자수, 12월 행사 선물용, 리본은 분리 가능하게"
                      />
                    </Field>
                  </>
                )}
                {step === 3 && (
                  <>
                    <dl className="cs-review">
                      <div>
                        <dt>인형</dt>
                        <dd>
                          {draft.design.name} ·{" "}
                          {kinds.find(k => k[0] === draft.design.kind)?.[1]}
                        </dd>
                      </div>
                      <div>
                        <dt>크기 · 수량</dt>
                        <dd>
                          {draft.design.heightCm}cm ·{" "}
                          {draft.quantity.toLocaleString()}개
                        </dd>
                      </div>
                      <div>
                        <dt>원단 · 옵션</dt>
                        <dd>
                          {materials[draft.material]}
                          {draft.design.keyring ? " · 키링 포함" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>참고 이미지</dt>
                        <dd>{refs.length}장</dd>
                      </div>
                      <div>
                        <dt>진행 방식</dt>
                        <dd>
                          {draft.purpose === "sample"
                            ? "샘플 먼저 확인"
                            : "수량 제작 견적"}
                        </dd>
                      </div>
                    </dl>
                    <Auth user={user} setMessage={setMessage} />
                    {user && (
                      <>
                        <div className="cs-two">
                          <Field title="담당자 이름">
                            <input
                              autoComplete="name"
                              maxLength={80}
                              value={contact.name}
                              onChange={e =>
                                setContact(c => ({
                                  ...c,
                                  name: e.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field title="전화번호 (선택)">
                            <input
                              type="tel"
                              autoComplete="tel"
                              maxLength={30}
                              value={contact.phone}
                              onChange={e =>
                                setContact(c => ({
                                  ...c,
                                  phone: e.target.value,
                                }))
                              }
                            />
                          </Field>
                        </div>
                        <label className="cs-checkbox">
                          <input
                            type="checkbox"
                            checked={contact.consent}
                            onChange={e =>
                              setContact(c => ({
                                ...c,
                                consent: e.target.checked,
                              }))
                            }
                          />
                          <span>
                            제작 상담을 위해 이름, 이메일, 선택한 전화번호와
                            디자인 자료를 운영자에게 전달하는 데 동의합니다.
                          </span>
                        </label>
                      </>
                    )}
                    <div className="cs-hint">
                      <Package size={20} />
                      <p>
                        접수 후 디자인과 제작 가능 여부를 검토합니다. 견적과
                        샘플을 확인한 뒤 제작을 확정하며, 지금 결제되는 금액은
                        없습니다.
                      </p>
                    </div>
                  </>
                )}
                <div className="cs-form-actions">
                  <button
                    className="cs-secondary"
                    disabled={step === 0 || busy}
                    onClick={() => move(step - 1)}
                  >
                    <ArrowLeft size={16} /> 이전
                  </button>
                  {step < 3 ? (
                    <button
                      className="cs-primary"
                      onClick={() => {
                        const parsed = customerDraftSchema.safeParse(draft);
                        if (!parsed.success) {
                          setMessage(
                            "인형 이름과 수량을 확인해 주세요. 수량은 1~100,000개의 정수로 입력해 주세요."
                          );
                          return;
                        }
                        move(step + 1);
                      }}
                    >
                      다음 단계 <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button
                      className="cs-primary"
                      disabled={busy || !user || !supabase}
                      onClick={submit}
                    >
                      {busy ? "접수하는 중…" : "제작 견적 요청하기"}{" "}
                      <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </fieldset>
              <aside className="cs-preview">
                <div className="cs-preview-top">
                  <span>
                    <span className="cs-live-dot" /> MY LITTLE FRIEND
                  </span>
                  <span>{draft.design.heightCm} cm</span>
                </div>
                <ThreeDesigner design={draft.design} view={view} />
                <div className="cs-view-tabs" aria-label="3D 시점">
                  {(
                    [
                      ["perspective", "자유 회전"],
                      ["front", "정면"],
                      ["side", "옆면"],
                      ["back", "뒷면"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={view === value}
                      onClick={() => setView(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="cs-preview-caption">
                  <h3>{draft.design.name || "나만의 인형"}</h3>
                  <p>
                    화면은 형태와 색상을 확인하는 참고용입니다.
                    <br />
                    실제 원단과 제작 비율은 샘플에서 확인해 주세요.
                  </p>
                </div>
                <button className="cs-save" onClick={download}>
                  <Download size={16} /> 디자인 파일 저장
                </button>
                <label className="cs-import">
                  저장한 디자인 불러오기
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        if (file.size > 100000) throw Error();
                        edit(
                          customerDraftSchema.parse(
                            JSON.parse(await file.text())
                          )
                        );
                        setMessage(
                          "디자인 설정을 불러왔습니다. 참고 이미지는 별도로 첨부해 주세요."
                        );
                      } catch {
                        setMessage("올바른 디자인 JSON 파일을 선택해 주세요.");
                      }
                    }}
                  />
                </label>
              </aside>
            </div>
          </>
        )}
        {message && (
          <div className="cs-message" role="status">
            <span>{message}</span>
            <button aria-label="안내 닫기" onClick={() => setMessage("")}>
              <X size={17} />
            </button>
          </div>
        )}
      </main>
      <footer className="cs-footer">
        <span>plush studio — 상상이 인형이 되는 곳</span>
        <span>디자인 → 견적 상담 → 샘플 확인 → 제작 확정</span>
      </footer>
    </div>
  );
}
