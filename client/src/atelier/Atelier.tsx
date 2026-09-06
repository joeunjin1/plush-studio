import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Save, Upload, Layers, Check, PanelLeft } from "lucide-react";
import { newRequestId } from "@/lib/requestId";
import { supabase } from "@/lib/supabase";
import {
  createProject,
  createProjectFromTemplate,
  parseProject,
  localCopy,
  productNames,
  type Project,
  type Part,
  type Asset,
} from "./project";
import { DesignProofPanel, ProductSettingsPanel, TemplatePanel } from "./ConfiguratorPanels";
import { productionRequestEligibility } from "./designProof";
import { getPrintZones, getTemplate, type TemplateId } from "./productDefinition";
import { templateIds } from "./productDefinition";
import { productGeometry } from "./geometry";
import {
  saveLocal,
  listLocal,
  saveCloud,
  listCloud,
  openCloud,
  readImage,
  imageDimensions,
  splitThreeView,
  hydrate,
} from "./storage";
import { ProductPreview, saveBlob } from "./ProductPreview";
import { FiveAngleReferencePreview } from "./FiveAngleReferencePreview";
import { ProductMall } from "./ProductMall";
import { referenceProductById, referenceProducts } from "./referenceProducts";
import { BuyerAuthGate } from "./BuyerAuthGate";
import {
  buyerAccessPrompt,
  completeBuyerDownloadAudit,
  recordBuyerDownload,
  type ProtectedArtifact,
  useBuyerSession,
} from "./buyerAccess";
import { extractOutline } from "./autoOutline";
import { OutlineEditor } from "./OutlineEditor";
import "./atelier.css";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="at-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function initialProjectFromUrl() {
  const candidate = new URLSearchParams(window.location.search).get("template") as TemplateId | null;
  return candidate && templateIds.includes(candidate)
    ? createProjectFromTemplate(candidate)
    : createProject();
}
function initialReferenceProductIdFromUrl() {
  const id = new URLSearchParams(window.location.search).get("reference");
  return referenceProductById(id)?.id ?? null;
}
export default function Atelier() {
  const [p, setP] = useState<Project>(initialProjectFromUrl),
    [tab, setTab] = useState("template"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [local, setLocal] = useState<Project[]>([]),
    [cloud, setCloud] = useState<
      Array<{ id: string; name: string; revision: number }>
    >([]),
    [shelf, setShelf] = useState(false),
    [pendingTemplate, setPendingTemplate] = useState<TemplateId | null>(null),
    [outlineView, setOutlineView] = useState<"front" | "side">("front"),
    [contact, setContact] = useState({
      name: "",
      phone: "",
      quantity: 100,
      consent: false,
    }),
    [receipt, setReceipt] = useState(""),
    [protectedArtifact, setProtectedArtifact] = useState<ProtectedArtifact | null>(null),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [referenceProductId, setReferenceProductId] = useState<string | null>(initialReferenceProductIdFromUrl),
    [mallOpen, setMallOpen] = useState(() => new URLSearchParams(window.location.search).get("mall") === "1");
  const operation = useRef(false),
    requestId = useRef(newRequestId()),
    dirty = useRef(false);
  const current = useRef(p);
  current.current = p;
  const { user: buyer } = useBuyerSession();
  const selectedReferenceProduct = referenceProductById(referenceProductId);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    const request = () => {
      const snapshot = (window as Window & { atelierSnapshot?: unknown })
        .atelierSnapshot;
      if (snapshot) {
        delete (window as Window & { atelierSnapshot?: unknown })
          .atelierSnapshot;
        run(async () => {
          const project = await hydrate(snapshot);
          setP(localCopy(project));
          dirty.current = true;
          setMessage("접수 당시 디자인을 복사본으로 열었습니다.");
        });
      }
    };
    window.addEventListener("atelier-open-snapshot", request);
    request();
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("atelier-open-snapshot", request);
    };
  }, []);
  const edit = (patch: Partial<Project>) => {
    setP(v => ({ ...v, ...patch, updatedAt: new Date().toISOString() }));
    dirty.current = true;
    requestId.current = newRequestId();
    setReceipt("");
  };
  const run = async (fn: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "처리 중 문제가 발생했습니다. 다시 시도해 주세요."
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const requireBuyer = (artifact: ProtectedArtifact, action?: () => Promise<void>) => {
    if (!buyer) {
      setProtectedArtifact(artifact);
      setMessage(buyerAccessPrompt(artifact));
      return;
    }
    if (action) void run(action);
  };
  const recordExport = (
    artifact: Exclude<ProtectedArtifact, "클라우드 저장" | "제작 견적 요청">
  ) => {
    return completeBuyerDownloadAudit(() =>
      recordBuyerDownload(artifact, p.id, p.revision)
    ).then(result => {
      if (!result.recorded) setMessage(result.message);
      return result.recorded;
    });
  };
  const backupCurrent = async () => {
    if (dirty.current) {
      await saveLocal(current.current);
      dirty.current = false;
    }
  };
  const showShelf = () =>
    run(async () => {
      await backupCurrent();
      setLocal(await listLocal());
      setShelf(true);
      setMessage(
        "이 기기의 저장 작업입니다. 다른 기기의 작업은 클라우드 목록에서 확인하세요."
      );
    });
  const replace = (project: Project) => {
    setP(project);
    setSelected([]);
    setShelf(false);
    setReceipt("");
    dirty.current = false;
    requestId.current = newRequestId();
  };
  const chooseTemplate = (templateId: TemplateId) => {
    if (p.templateId === templateId) return;
    setPendingTemplate(templateId);
  };
  const startTemplate = () => {
    if (!pendingTemplate) return;
    const templateId = pendingTemplate;
    const next = getTemplate(templateId);
    void run(async () => {
      await backupCurrent();
      replace(createProjectFromTemplate(templateId));
      setPendingTemplate(null);
      setTab("shape");
      setMessage(`${next.label}의 기본 구조를 불러왔습니다. 치수와 참조 이미지를 이어서 확인하세요.`);
    });
  };
  const addAsset = async (
    file: File | undefined,
    view?: "front" | "side" | "back"
  ) => {
    if (!file) return;
    await run(async () => {
      if (p.assets.length >= 12)
        throw Error("이미지는 최대 12개까지 보관할 수 있습니다.");
      const data = await readImage(file),
        dimensions = await imageDimensions(data),
        asset: Asset = {
        id: newRequestId(),
        name: file.name,
        data,
        width: dimensions.width,
        height: dimensions.height,
      };
      const printZone = p.templateId
        ? getPrintZones({ templateId: p.templateId, width: p.width, height: p.height })[0]
        : undefined;
      edit({
        assets: [...p.assets, asset],
        ...(view
          ? { references: { ...p.references, [view]: asset.id },
              ...(view !== "back" ? { [view]: [], useOutline: false } : {}) }
          : {
              decals: [
                ...p.decals,
                {
                  id: newRequestId(),
                  assetId: asset.id,
                  face: "front" as const,
                  x: printZone?.x ?? 0,
                  y: printZone?.y ?? 0,
                  size: Math.min(p.width * 0.4, printZone?.width ?? 100),
                  rotation: 0,
                },
              ],
            }),
      });
      setMessage(
        view
          ? "삼면도 이미지를 추가했습니다. 윤곽을 지정하면 3D에 반영할 수 있습니다."
          : "디자인을 추가했습니다. 위치와 크기를 조정하세요."
      );
    });
  };
  const updatePart = (id: string, patch: Partial<Part>) =>
    edit({
      parts: p.parts.map(part =>
        part.id === id ? { ...part, ...patch } : part
      ),
    });
  const choosePart = (id: string) => {
    const part = p.parts.find(v => v.id === id);
    const ids = part?.group
      ? p.parts.filter(v => v.group === part.group).map(v => v.id)
      : [id];
    setSelected(old =>
      old.includes(id)
        ? old.filter(i => !ids.includes(i))
        : Array.from(new Set([...old, ...ids]))
    );
  };
  const submit = () => {
    if (!buyer) {
      setProtectedArtifact("제작 견적 요청");
      setMessage(buyerAccessPrompt("제작 견적 요청"));
      return;
    }
    void run(async () => {
      if (!supabase) throw Error("온라인 접수 연결이 필요합니다.");
      const eligibility = productionRequestEligibility(p);
      if (!eligibility.eligible)
        throw Error("완성도 검사에서 보완할 항목이 있습니다. 5. 완성도 검사에서 빨간 항목을 해결한 뒤 접수해 주세요.");
      if (
        contact.name.trim().length < 2 ||
        !Number.isInteger(contact.quantity) ||
        contact.quantity < 1 ||
        contact.quantity > 100000 ||
        !contact.consent
      )
        throw Error(
          "담당자 이름, 수량(1~100,000개), 상담 동의를 확인해 주세요."
        );
      if (contact.phone && !/^[+\d() -]{7,30}$/.test(contact.phone))
        throw Error("전화번호를 확인해 주세요.");
      const saved = await saveCloud(p);
      setP(saved);
      dirty.current = false;
      const { data, error } = await supabase.rpc("submit_atelier_request", {
        p_id: requestId.current,
        p_project_id: saved.id,
        p_revision: saved.revision,
        p_name: contact.name.trim(),
        p_phone: contact.phone,
        p_quantity: contact.quantity,
      });
      if (error)
        throw Error(
          "접수 확인을 받지 못했습니다. 다시 접수하면 같은 접수번호로 중복을 방지합니다."
        );
      setReceipt(String(data));
      setMessage(
        "제작 견적 요청이 접수되었습니다. 내 제작 요청에서 확인하세요."
      );
    });
  };
  return (
    <div className="atelier" onClickCapture={e => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      e.preventDefault();
      const destination = link.getAttribute("href")!;
      run(async () => { await backupCurrent(); window.location.hash = destination; });
    }}>
      <BuyerAuthGate
        artifact={protectedArtifact}
        onClose={() => setProtectedArtifact(null)}
        onMessage={setMessage}
        open={Boolean(protectedArtifact)}
        user={buyer}
      />
      <header className="at-header">
        <a href="#design">
          <ArrowLeft size={17} /> 제품 만들기
        </a>
        <b>
          PRODUCT ATELIER <small>구조와 디자인을 함께 완성하는 3D 제품 만들기</small>
        </b>
        <a href="#requests">내 제작 요청</a>
      </header>
      <main className="at-main">
        <div className="at-layout">
          <aside
            aria-label="제품 편집 패널"
            className="at-workspace-sidebar"
            data-open={sidebarOpen}
            id="atelier-controls"
          >
            <div className="at-sidebar-heading">
              <span>PRODUCT WORKSPACE</span>
              <button
                aria-label="편집 패널 닫기"
                className="at-sidebar-close"
                onClick={() => setSidebarOpen(false)}
              >
                ×
              </button>
            </div>
            <fieldset disabled={busy} className="at-toolbar">
              <div>
                {(Object.keys(productNames) as Project["product"][]).map(
                  product => (
                    <button
                      key={product}
                      aria-pressed={p.product === product}
                      onClick={() => chooseTemplate(product === "plush" ? "bear" : product === "bag" ? "tote" : "tee-regular")}
                    >
                      {productNames[product]}
                    </button>
                  )
                )}
              </div>
              <input
                aria-label="제품 디자인 이름"
                value={p.name}
                maxLength={100}
                onChange={e => edit({ name: e.target.value })}
              />
              <div className="at-save-actions">
                <button
                  onClick={() =>
                    run(async () => {
                      await saveLocal(p);
                      dirty.current = false;
                      setMessage(
                        "이미지·윤곽·부위를 이 기기에 저장했습니다. 내 저장 작업에서 다시 열 수 있습니다."
                      );
                    })
                  }
                >
                  <Save size={16} /> 이 기기 저장
                </button>
                <button
                  className="at-primary"
                  onClick={() =>
                    requireBuyer("클라우드 저장", async () => {
                      const saved = await saveCloud(p);
                      setP(saved);
                      dirty.current = false;
                      setMessage(
                        "계정에 저장했습니다. 다른 기기에서도 로그인 후 열 수 있습니다."
                      );
                    })
                  }
                >
                  클라우드 저장
                </button>
              </div>
            </fieldset>
            <section className="at-reference-library" aria-label="공식 기준 상품 라이브러리">
              <div className="at-reference-library-heading">
                <span>REFERENCE PRODUCT LIBRARY</span>
                <p>실사 5면 기준 상품</p>
              </div>
              <button className="at-open-mall" onClick={() => {
                setMallOpen(true);
                setSidebarOpen(false);
              }}>
                상품몰 열기
              </button>
              {referenceProducts.map(product => (
                <button
                  aria-pressed={referenceProductId === product.id}
                  className="at-reference-product-card"
                  key={product.id}
                  onClick={() => {
                    setReferenceProductId(product.id);
                    setMallOpen(false);
                    setSidebarOpen(false);
                  }}
                >
                  <img alt="" src={product.views.front.image} />
                  <span>
                    <b>{product.title}</b>
                    <small>{product.sku}</small>
                    <small>{product.reviewLabel}</small>
                  </span>
                </button>
              ))}
              {selectedReferenceProduct && (
                <button
                  className="at-reference-return"
                  onClick={() => setReferenceProductId(null)}
                >
                  기본 3D 편집기로 돌아가기
                </button>
              )}
            </section>
            <fieldset disabled={busy} className="at-controls">
            <nav>
              {[
                ["template", "1. 제품 템플릿"],
                ["shape", "2. 치수 · 참조"],
                ["print", "3. 소재 · 인쇄"],
                ["parts", "4. 구조 부위"],
                ["proof", "5. 완성도 검사"],
                ["request", "6. 확인 · 접수"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-current={tab === id ? "step" : undefined}
                  onClick={() => {
                    setTab(id);
                    setSidebarOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === "template" && (
              <TemplatePanel project={p} onSelect={chooseTemplate} />
            )}
            {tab === "shape" && (
              <>
                <h2>{getTemplate(p.templateId!).label}의 비율을 맞춰 보세요</h2>
                <p>
                  기본 구조는 템플릿이 유지합니다. 삼면도는 비율과 그래픽을 보정하는 참고 자료이며, 사진만으로 봉제 구조를 자동 복원하지는 않습니다.
                </p>
                <div className="at-dimensions">
                  {(["width", "height", "depth"] as const).map((key, i) => (
                    <Field
                      key={key}
                      label={`${["가로", "세로", "두께"][i]} (cm)`}
                    >
                      <input
                        type="number"
                        min="0.1"
                        max="200"
                        step=".1"
                        value={p[key]}
                        onChange={e =>
                          edit({
                            [key]: Math.min(
                              200,
                              Math.max(0.1, Number(e.target.value))
                            ),
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
                <label className="at-upload-button">
                  삼면도 한 장 올리기 · 정면 / 옆면 / 뒷면
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="삼면도 한 장 업로드"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file)
                        run(async () => {
                          if (p.assets.length > 9)
                            throw Error(
                              "이미지 저장 공간이 부족합니다. 새 작업에서 올려 주세요."
                            );
                          const data = await splitThreeView(file);
                          const added = data.map((image, i) => ({
                            id: newRequestId(),
                            name: `${file.name}-${["정면", "옆면", "뒷면"][i]}`,
                            data: image,
                          }));
                          edit({
                            assets: [...p.assets, ...added],
                            references: {
                              front: added[0].id,
                              side: added[1].id,
                              back: added[2].id,
                            },
                            front: [],
                            side: [],
                            useOutline: false,
                          });
                          setMessage(
                            "삼면도를 세 면으로 나눴습니다. 각 면의 윤곽을 지정하세요."
                          );
                        });
                    }}
                  />
                </label>
                <div className="at-upload-grid">
                  {(["front", "side", "back"] as const).map((view, i) => (
                    <label key={view}>
                      {p.references[view] ? (
                        <img
                          src={
                            p.assets.find(a => a.id === p.references[view])
                              ?.data
                          }
                          alt={`${view} 참고 이미지`}
                        />
                      ) : (
                        <Upload size={22} />
                      )}
                      <b>{["정면", "옆면", "뒷면"][i]}</b>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label={`${["정면", "옆면", "뒷면"][i]} 삼면도 업로드`}
                        onChange={e => {
                          void addAsset(e.target.files?.[0], view);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ))}
                </div>
                <p className="at-help">
                  가로 삼면도는 위 버튼으로 세 면을 나누고, 개별 이미지도 아래에서 올릴 수 있습니다. 이미지는 최대 1,200px로 보관되며, 투명 또는 단색 배경일수록 윤곽 검토가 정확합니다.
                </p>
                <div className="at-tabs">
                  <button
                    aria-pressed={outlineView === "front"}
                    onClick={() => setOutlineView("front")}
                  >
                    정면 윤곽
                  </button>
                  <button
                    aria-pressed={outlineView === "side"}
                    onClick={() => setOutlineView("side")}
                  >
                    옆면 윤곽 (선택)
                  </button>
                </div>
                <button
                  onClick={() =>
                    run(async () => {
                      const image = p.assets.find(
                        a => a.id === p.references[outlineView]
                      )?.data;
                      if (!image)
                        throw Error(
                          "먼저 해당 면의 참고 이미지를 올려 주세요."
                        );
                      const points = await extractOutline(image);
                      edit({ [outlineView]: points, useOutline: false });
                      setMessage(
                        "가장 큰 외곽선을 추출했습니다. 구멍·떨어진 부위는 포함되지 않으므로 확인한 뒤 3D 만들기를 누르세요."
                      );
                    })
                  }
                >
                  이미지에서 윤곽 자동 찾기
                </button>
                <p className="at-help">
                  투명 또는 단색 배경에 적합합니다. 작은 분리 부위와 내부 구멍은
                  별도로 지정해 주세요.
                </p>
                <OutlineEditor
                  label={outlineView === "front" ? "정면" : "옆면"}
                  image={
                    p.assets.find(a => a.id === p.references[outlineView])?.data
                  }
                  points={p[outlineView]}
                  onChange={points =>
                    edit({ [outlineView]: points, useOutline: false })
                  }
                />
                <button
                  className="at-primary"
                  onClick={() => {
                    try {
                      const candidate = { ...p, useOutline: true };
                      const g = productGeometry(candidate);
                      g.dispose();
                      edit({ useOutline: true });
                      setMessage("윤곽이 3D 형상에 반영되었습니다.");
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "윤곽을 확인해 주세요."
                      );
                    }
                  }}
                >
                  윤곽으로 3D 만들기
                </button>
                <button onClick={() => edit({ useOutline: false })}>
                  기본형으로 보기
                </button>
                <p className="at-help">
                  손잡이·소매·귀처럼 분리된 구조는 다음 ‘구조 부위’ 단계에서 템플릿 부위로 조정하세요. 윤곽은 본체 비율을 확인하는 보조 수단입니다.
                </p>
              </>
            )}
            {tab === "print" && (
              <>
                <ProductSettingsPanel
                  project={p}
                  onParameters={parameters => edit({ parameters })}
                  onMaterials={materials => edit({ materials })}
                />
                <h2>컬러와 디자인을 더하세요</h2>
                <Field label="제품 바탕색">
                  <input
                    type="color"
                    value={p.color}
                    onChange={e => edit({ color: e.target.value })}
                  />
                </Field>
                <div className="at-swatches">
                  {[
                    "#aec3ad",
                    "#edd1bd",
                    "#d9b5cb",
                    "#b1c4dd",
                    "#f4e8c1",
                    "#353b42",
                  ].map(color => (
                    <button
                      style={{ background: color }}
                      key={color}
                      aria-label={`바탕색 ${color}`}
                      onClick={() => edit({ color })}
                    >
                      {p.color === color && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <label className="at-upload-button">
                  <Plus size={17} /> 로고 · 디자인 이미지 추가
                  <input
                    disabled={p.decals.length >= 6}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="디자인 이미지 업로드"
                    onChange={e => {
                      void addAsset(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="at-help">
                  최대 6개. 배경 없는 PNG를 사용하면 바탕색과 자연스럽게 어울립니다. 그래픽은 선택한 인쇄 안전 영역 안에 배치해야 완성도 검사를 통과합니다.
                </p>
                <div className="at-print-zones" aria-label="인쇄 안전 영역">
                  {getPrintZones({ templateId: p.templateId!, width: p.width, height: p.height }).map(zone => (
                    <article key={zone.id}>
                      <b>{zone.label}</b>
                      <span>{zone.face === "front" ? "정면" : "뒷면"} · 최대 {zone.width} × {zone.height}cm</span>
                    </article>
                  ))}
                </div>
                {p.decals.map(d => (
                  <section className="at-decal" key={d.id}>
                    <div className="at-decal-heading">
                      <img
                        src={p.assets.find(a => a.id === d.assetId)?.data}
                        alt="추가 디자인"
                      />
                      <b>{p.assets.find(a => a.id === d.assetId)?.name}</b>
                      <button
                        onClick={() =>
                          edit({ decals: p.decals.filter(v => v.id !== d.id) })
                        }
                      >
                        제거
                      </button>
                    </div>
                    <Field label="적용 면">
                      <select
                        value={d.face}
                        onChange={e =>
                          edit({
                            decals: p.decals.map(v =>
                              v.id === d.id
                                ? {
                                    ...v,
                                    face: e.target.value as "front" | "back",
                                  }
                                : v
                            ),
                          })
                        }
                      >
                        <option value="front">정면</option>
                        <option value="back">뒷면 (3D에서 확인)</option>
                      </select>
                    </Field>
                    {(["x", "y", "size", "rotation"] as const).map((key, i) => (
                      <Field
                        key={key}
                        label={`${["가로 위치 (cm)", "세로 위치 (cm)", "가로 크기 (cm)", "회전 (도)"][i]} · ${d[key]}`}
                      >
                        <input
                          type="range"
                          min={
                            key === "size"
                              ? 0.5
                              : key === "rotation"
                                ? -180
                                : -100
                          }
                          max={key === "rotation" ? 180 : 100}
                          step={0.5}
                          value={d[key]}
                          onChange={e =>
                            edit({
                              decals: p.decals.map(v =>
                                v.id === d.id
                                  ? { ...v, [key]: Number(e.target.value) }
                                  : v
                              ),
                            })
                          }
                        />
                      </Field>
                    ))}
                  </section>
                ))}
              </>
            )}
            {tab === "parts" && (
              <>
                <h2>구조 부위를 확인하고 조정하세요</h2>
                <p>
                  {getTemplate(p.templateId!).label}에는 필요한 구조 부위가 기본으로 포함되어 있습니다. 손잡이·지퍼·스트랩·소매처럼 실제 구성품을 먼저 확인하고, 필요한 경우에만 고급 부위를 추가하세요.
                </p>
                <button
                  disabled={p.parts.length >= 12}
                  onClick={() => {
                    const part: Part = {
                      id: newRequestId(),
                      name: `부위 ${p.parts.length + 1}`,
                      shape: "sphere",
                      color: p.color,
                      width: 5,
                      height: 5,
                      depth: 3,
                      x: 0,
                      y: 0,
                      z: p.depth / 2,
                      rotation: 0,
                      kind: "custom-part",
                      materialSlot: "body",
                      fabric: "원단 지정",
                      trims: "",
                      process: "봉제",
                      toleranceMm: 2,
                      front: [],
                      side: [],
                    };
                    edit({ parts: [...p.parts, part] });
                    setSelected([part.id]);
                  }}
                >
                  <Plus size={16} /> 고급: 사용자 부위 추가
                </button>
                <div className="at-part-list">
                  {p.parts.map(part => (
                    <label key={part.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(part.id)}
                        onChange={() => choosePart(part.id)}
                      />
                      {part.name}
                      {part.group && <small>묶음</small>}
                    </label>
                  ))}
                </div>
                <button
                  disabled={selected.length < 2}
                  onClick={() => {
                    const group = newRequestId();
                    edit({
                      parts: p.parts.map(part =>
                        selected.includes(part.id) ? { ...part, group } : part
                      ),
                    });
                  }}
                >
                  선택 부위 묶기
                </button>
                <button
                  disabled={!selected.length}
                  onClick={() =>
                    edit({
                      parts: p.parts.map(part =>
                        selected.includes(part.id)
                          ? { ...part, group: undefined }
                          : part
                      ),
                    })
                  }
                >
                  묶음 분리
                </button>
                {selected.length > 1 && (
                  <div className="at-group-move">
                    {(["x", "y", "z"] as const).map(axis => (
                      <button
                        key={axis}
                        onClick={() =>
                          edit({
                            parts: p.parts.map(part =>
                              selected.includes(part.id)
                                ? {
                                    ...part,
                                    [axis]: Math.min(200, part[axis] + 1),
                                  }
                                : part
                            ),
                          })
                        }
                      >
                        {axis.toUpperCase()} 방향 함께 +1cm
                      </button>
                    ))}
                  </div>
                )}
                {p.parts
                  .filter(part => selected.includes(part.id))
                  .map(part => (
                    <section className="at-decal" key={part.id}>
                      <Field label="부위 이름">
                        <input
                          value={part.name}
                          maxLength={60}
                          onChange={e =>
                            updatePart(part.id, { name: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="형태">
                        <select
                          value={part.shape}
                          onChange={e =>
                            updatePart(part.id, {
                              shape: e.target.value as Part["shape"],
                            })
                          }
                        >
                          <option value="sphere">둥근 부위</option>
                          <option value="box">사각 부위</option>
                          <option value="capsule">스트랩·소매형</option>
                          <option value="torus">고리·손잡이형</option>
                          <option value="cylinder">원통형</option>
                          <option value="outline">직접 그린 윤곽</option>
                        </select>
                      </Field>
                      <Field label="소재 슬롯">
                        <select
                          value={part.materialSlot ?? "body"}
                          onChange={e => updatePart(part.id, { materialSlot: e.target.value })}
                        >
                          {getTemplate(p.templateId!).materialSlots.map(slot => <option value={slot.id} key={slot.id}>{slot.label}</option>)}
                        </select>
                      </Field>
                      <Field label="BOM 원단·소재">
                        <input
                          value={part.fabric}
                          maxLength={80}
                          placeholder="예: 10mm 밍크, 16수 캔버스"
                          onChange={e => updatePart(part.id, { fabric: e.target.value })}
                        />
                      </Field>
                      <Field label="BOM 부자재">
                        <input
                          value={part.trims}
                          maxLength={160}
                          placeholder="예: 5호 지퍼, D링, 자수사"
                          onChange={e => updatePart(part.id, { trims: e.target.value })}
                        />
                      </Field>
                      <Field label="BOM 공정">
                        <input
                          value={part.process}
                          maxLength={160}
                          placeholder="예: 라운드 봉제, 상침, 자수"
                          onChange={e => updatePart(part.id, { process: e.target.value })}
                        />
                      </Field>
                      <Field label="허용 오차 (mm)">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={part.toleranceMm}
                          onChange={e => updatePart(part.id, { toleranceMm: Math.max(0, Math.min(50, Number(e.target.value))) })}
                        />
                      </Field>
                      <Field label="부위 색상">
                        <input
                          type="color"
                          value={part.color}
                          onChange={e =>
                            updatePart(part.id, { color: e.target.value })
                          }
                        />
                      </Field>
                      <div className="at-dimensions">
                        {(
                          [
                            "width",
                            "height",
                            "depth",
                            "x",
                            "y",
                            "z",
                            "rotation",
                          ] as const
                        ).map((key, i) => (
                          <Field
                            key={key}
                            label={
                              [
                                "가로 cm",
                                "세로 cm",
                                "두께 cm",
                                "X cm",
                                "Y cm",
                                "Z cm",
                                "회전 도",
                              ][i]
                            }
                          >
                            <input
                              type="number"
                              min={i < 3 ? 0.1 : -180}
                              max={180}
                              step=".5"
                              value={part[key]}
                              onChange={e =>
                                updatePart(part.id, {
                                  [key]: Math.max(
                                    i < 3 ? 0.1 : -180,
                                    Math.min(180, Number(e.target.value))
                                  ),
                                })
                              }
                            />
                          </Field>
                        ))}
                      </div>
                      {part.shape === "outline" && (
                        <OutlineEditor
                          label={`${part.name} 정면`}
                          image={
                            p.assets.find(a => a.id === p.references.front)
                              ?.data
                          }
                          points={part.front}
                          onChange={front => updatePart(part.id, { front })}
                        />
                      )}
                      <button
                        onClick={() => {
                          edit({
                            parts: p.parts.filter(v => v.id !== part.id),
                          });
                          setSelected(s => s.filter(id => id !== part.id));
                        }}
                      >
                        이 부위 제거
                      </button>
                    </section>
                  ))}
              </>
            )}
            {tab === "proof" && (
              <DesignProofPanel
                authenticated={Boolean(buyer)}
                onMessage={setMessage}
                onProtectedExport={recordExport}
                onRequireAuthentication={artifact => requireBuyer(artifact)}
                project={p}
              />
            )}
            {tab === "request" && (
              <>
                <h2>디자인을 고정하고 제작 요청</h2>
                <p>
                  {p.name} · {getTemplate(p.templateId!).label}
                  <br />
                  {p.width} × {p.height} × {p.depth}cm · 부위 {p.parts.length}개
                  · 디자인 {p.decals.length}개
                </p>
                <p className="at-readiness-hint">
                  먼저 5. 완성도 검사에서 Design Proof를 확인하세요. 빨간 보완 항목이 있는 디자인은 제작 요청을 접수할 수 없습니다.
                </p>
                <Field label="제작 설명 · 희망 일정">
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={p.notes}
                    onChange={e => edit({ notes: e.target.value })}
                  />
                </Field>
                <Field label="담당자 이름">
                  <input
                    maxLength={80}
                    value={contact.name}
                    onChange={e =>
                      setContact(c => ({ ...c, name: e.target.value }))
                    }
                  />
                </Field>
                <Field label="전화번호 (선택)">
                  <input
                    type="tel"
                    maxLength={30}
                    value={contact.phone}
                    onChange={e =>
                      setContact(c => ({ ...c, phone: e.target.value }))
                    }
                  />
                </Field>
                <Field label="희망 수량">
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={contact.quantity}
                    onChange={e =>
                      setContact(c => ({
                        ...c,
                        quantity: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <label className="at-consent">
                  <input
                    type="checkbox"
                    checked={contact.consent}
                    onChange={e =>
                      setContact(c => ({ ...c, consent: e.target.checked }))
                    }
                  />
                  제작 상담을 위해 이름, 로그인 이메일, 선택한 전화번호와 디자인
                  자료를 운영자에게 전달하는 데 동의합니다.
                </label>
                <button className="at-primary" onClick={submit}>
                  현재 디자인으로 제작 견적 요청
                </button>
                <p className="at-help">
                  이메일 로그인이 필요합니다. 접수 시 현재 디자인과 이미지를
                  고정해 보관합니다. Design Proof는 디자인 검토 자료이며, 실제 샘플·색상·원단·공정 가능 여부는 전문가 검토 후 최종 확인됩니다.
                </p>
                <p className="at-help"><a href="#requests">이메일 로그인 / 내 요청 확인</a> · 이동 전 변경 내용을 이 기기에 저장합니다. 돌아오면 ‘내 저장 작업’에서 이어서 편집하세요.</p>
                {receipt && (
                  <p className="at-receipt">
                    접수 완료 · {receipt}
                    <br />
                    <a href="#requests">내 제작 요청 보기</a>
                  </p>
                )}
              </>
            )}
            </fieldset>
          </aside>
          {pendingTemplate && (
            <section aria-modal="true" className="at-template-confirm" role="dialog" aria-label="새 제품 템플릿 시작 확인">
              <div>
                <span>NEW TEMPLATE</span>
                <h2>{getTemplate(pendingTemplate).label}로 새 디자인을 시작할까요?</h2>
                <p>현재 작업은 이 기기에 먼저 저장됩니다. 새 템플릿에는 제품 구조·소재 슬롯·인쇄 안전 영역이 포함됩니다.</p>
                <div>
                  <button onClick={() => setPendingTemplate(null)}>현재 작업 계속</button>
                  <button className="at-primary" onClick={startTemplate}>새 템플릿 시작</button>
                </div>
              </div>
            </section>
          )}
          <section className="at-workspace-stage" aria-label="제품 프리뷰">
            <div className="at-stage-header">
              <div>
                <span>{mallOpen ? "구매자 상품몰" : selectedReferenceProduct ? "공식 5면 기준 상품" : getTemplate(p.templateId!).label}</span>
                <b>{mallOpen ? "공식 상품몰" : selectedReferenceProduct ? selectedReferenceProduct.title : `${p.width} × ${p.height} × ${p.depth} cm`}</b>
              </div>
              <div>
                <button
                  aria-controls="atelier-controls"
                  aria-expanded={sidebarOpen}
                  className="at-mobile-sidebar-toggle"
                  onClick={() => setSidebarOpen(true)}
                >
                  <PanelLeft size={16} /> 편집
                </button>
                <button onClick={showShelf} disabled={busy}>
                  <Layers size={16} /> 내 저장 작업
                </button>
              </div>
            </div>
            {mallOpen ? (
              <ProductMall
                onSelect={product => {
                  setReferenceProductId(product.id);
                  setMallOpen(false);
                  setMessage(`${product.title}을(를) 선택했습니다. 개인화 방식을 먼저 고른 뒤 내용을 적용해 주세요.`);
                }}
                products={referenceProducts}
              />
            ) : selectedReferenceProduct ? (
              <FiveAngleReferencePreview
                onMessage={setMessage}
                product={selectedReferenceProduct}
              />
            ) : (
              <ProductPreview
                authenticated={Boolean(buyer)}
                onMessage={setMessage}
                onProtectedExport={recordExport}
                onRequireAuthentication={artifact => requireBuyer(artifact)}
                project={p}
              />
            )}
            {!selectedReferenceProduct && <div className="at-backups">
              <button
                disabled={busy}
                onClick={() => {
                  if (!buyer) {
                    requireBuyer("전체 백업 JSON");
                    return;
                  }
                  try {
                    parseProject(p);
                    saveBlob(
                      new Blob([JSON.stringify(p)], {
                        type: "application/json",
                      }),
                      `${p.name}-complete.json`
                    );
                    void recordExport("전체 백업 JSON").then(recorded => {
                      if (recorded)
                        setMessage(
                          "이미지와 부위가 포함된 전체 백업을 저장했습니다."
                        );
                    });
                  } catch {
                    setMessage("이름과 윤곽을 확인한 후 저장해 주세요.");
                  }
                }}
              >
                이미지 포함 전체 백업
              </button>
              <label>
                백업 불러오기
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={busy}
                  aria-label="전체 백업 불러오기"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      run(async () => {
                        if (file.size > 36 * 1024 * 1024)
                          throw Error("백업은 36MB 이하로 올려 주세요.");
                        const project = parseProject(
                          JSON.parse(await file.text())
                        );
                        await backupCurrent();
                        replace(localCopy(project));
                        dirty.current = true;
                        setMessage(
                          "백업을 복사본으로 복구했습니다. 저장 버튼으로 보관하세요."
                        );
                      });
                  }}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await backupCurrent();
                    replace(localCopy(p));
                    dirty.current = true;
                    setMessage("기존 작업을 보관하고 복사본을 만들었습니다.");
                  })
                }
              >
                복사본 만들기
              </button>
            </div>}
            {!selectedReferenceProduct && <p className="at-help">
              이 기기 저장은 브라우저 데이터 삭제 시 사라질 수 있습니다. 다른
              기기에서도 쓰려면 클라우드 저장 또는 전체 백업을 이용하세요.
            </p>}
          </section>
        </div>
        {shelf && (
          <section className="at-shelf">
            <header>
              <h2>내 저장 작업</h2>
              <button onClick={() => setShelf(false)}>닫기</button>
            </header>
            <p>
              이 기기에 저장된 작업 · 공용 기기에서는 다른 사용자가 볼 수
              있습니다.
            </p>
            {local.map(project => (
              <button
                className="at-saved"
                key={project.id}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await backupCurrent();
                    replace(project);
                    setMessage("이미지·부위·디자인을 복구했습니다.");
                  })
                }
              >
                <b>{project.name}</b>
                <span>
                  {productNames[project.product]} ·{" "}
                  {new Date(project.updatedAt).toLocaleString("ko-KR")}
                </span>
              </button>
            ))}
            {!local.length && <p>저장된 작업이 없습니다.</p>}
            <button
              disabled={busy}
              onClick={() =>
                requireBuyer("클라우드 저장", async () => {
                  setCloud(await listCloud());
                  setMessage("로그인한 계정의 클라우드 작업입니다.");
                })
              }
            >
              클라우드 목록 불러오기
            </button>
            {cloud.map(project => (
              <button
                key={project.id}
                className="at-saved"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await backupCurrent();
                    replace(await openCloud(project.id));
                    setMessage("클라우드 작업과 이미지를 복구했습니다.");
                  })
                }
              >
                {project.name} · 버전 {project.revision}
              </button>
            ))}
          </section>
        )}
        {message && (
          <div className="at-message" role="status">
            {message}
            <button onClick={() => setMessage("")} aria-label="안내 닫기">
              ×
            </button>
          </div>
        )}
        {busy && (
          <p className="at-busy" role="status">
            파일과 작업을 처리하고 있습니다…
          </p>
        )}
      </main>
    </div>
  );
}
