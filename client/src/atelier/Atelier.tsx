import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Save, Upload, Layers, Check } from "lucide-react";
import { newRequestId } from "@/lib/requestId";
import { supabase } from "@/lib/supabase";
import {
  createProject,
  parseProject,
  localCopy,
  productNames,
  type Project,
  type Part,
  type Asset,
} from "./project";
import { productGeometry } from "./geometry";
import {
  saveLocal,
  listLocal,
  saveCloud,
  listCloud,
  openCloud,
  readImage,
  splitThreeView,
  hydrate,
} from "./storage";
import { ProductPreview, saveBlob } from "./ProductPreview";
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
export default function Atelier() {
  const [p, setP] = useState<Project>(() => createProject()),
    [tab, setTab] = useState("shape"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [local, setLocal] = useState<Project[]>([]),
    [cloud, setCloud] = useState<
      Array<{ id: string; name: string; revision: number }>
    >([]),
    [shelf, setShelf] = useState(false),
    [outlineView, setOutlineView] = useState<"front" | "side">("front"),
    [contact, setContact] = useState({
      name: "",
      phone: "",
      quantity: 100,
      consent: false,
    }),
    [receipt, setReceipt] = useState("");
  const operation = useRef(false),
    requestId = useRef(newRequestId()),
    dirty = useRef(false);
  const current = useRef(p);
  current.current = p;
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
  const addAsset = async (
    file: File | undefined,
    view?: "front" | "side" | "back"
  ) => {
    if (!file) return;
    await run(async () => {
      if (p.assets.length >= 12)
        throw Error("이미지는 최대 12개까지 보관할 수 있습니다.");
      const asset: Asset = {
        id: newRequestId(),
        name: file.name,
        data: await readImage(file),
      };
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
                  x: 0,
                  y: 0,
                  size: Math.min(p.width * 0.4, 100),
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
  const submit = () =>
    run(async () => {
      if (!supabase) throw Error("온라인 접수 연결이 필요합니다.");
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
  return (
    <div className="atelier" onClickCapture={e => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      e.preventDefault();
      const destination = link.getAttribute("href")!;
      run(async () => { await backupCurrent(); window.location.hash = destination; });
    }}>
      <header className="at-header">
        <a href="#design">
          <ArrowLeft size={17} /> 쉬운 인형 만들기
        </a>
        <b>
          PRODUCT ATELIER <small>삼면도로 만드는 나만의 제품</small>
        </b>
        <a href="#requests">내 제작 요청</a>
      </header>
      <main className="at-main">
        <div className="at-title">
          <div>
            <p>DESIGN · PREVIEW · MAKE</p>
            <h1>그림에서 제품으로.</h1>
            <span>
              인형, 가방, 티셔츠를 편집하고 디자인 파일까지 보관하세요.
            </span>
          </div>
          <button onClick={showShelf} disabled={busy}>
            <Layers size={16} /> 내 저장 작업
          </button>
        </div>
        <fieldset disabled={busy} className="at-toolbar">
          <div>
            {(Object.keys(productNames) as Project["product"][]).map(
              product => (
                <button
                  key={product}
                  aria-pressed={p.product === product}
                  onClick={() =>
                    run(async () => {
                      await backupCurrent();
                      replace(createProject(product));
                      setMessage(
                        "이전 변경은 이 기기에 저장하고 새 작업을 열었습니다."
                      );
                    })
                  }
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
              run(async () => {
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
        </fieldset>
        <div className="at-layout">
          <fieldset disabled={busy} className="at-controls">
            <nav>
              {[
                ["shape", "1. 형태 · 삼면도"],
                ["print", "2. 컬러 · 디자인"],
                ["parts", "3. 부위 편집"],
                ["request", "4. 확인 · 접수"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-current={tab === id ? "step" : undefined}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === "shape" && (
              <>
                <h2>삼면도로 형태를 맞춰 보세요</h2>
                <p>
                  정면 윤곽과 두께만으로 입체를 만들거나, 정면·옆면 윤곽을 함께
                  사용하세요. 뒷면은 제작 참고 이미지로 보관됩니다.
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
                  가로 삼면도는 위 버튼으로 세 면을 나누고, 개별 이미지도
                  아래에서 올릴 수 있습니다. 이미지는 최대 1,200px로 보관합니다.
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
                  팔·다리처럼 가로로 갈라지는 윤곽은 두께 방식(옆면 윤곽 없음)을
                  쓰거나 별도 부위로 나누세요. 사진만으로 봉제 구조를 자동
                  복원하지는 않습니다.
                </p>
              </>
            )}
            {tab === "print" && (
              <>
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
                  최대 6개. 배경 없는 PNG를 사용하면 바탕색과 자연스럽게
                  어울립니다.
                </p>
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
                <h2>부위를 나눠 수정하세요</h2>
                <p>
                  귀, 손잡이, 리본 등 부위를 개별 객체로 추가합니다. 선택한
                  부위는 묶거나 분리할 수 있고, GLB에도 분리된 객체로
                  저장됩니다.
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
                      front: [],
                      side: [],
                    };
                    edit({ parts: [...p.parts, part] });
                    setSelected([part.id]);
                  }}
                >
                  <Plus size={16} /> 부위 추가
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
                          <option value="outline">직접 그린 윤곽</option>
                        </select>
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
            {tab === "request" && (
              <>
                <h2>디자인을 고정하고 제작 요청</h2>
                <p>
                  {p.name} · {productNames[p.product]}
                  <br />
                  {p.width} × {p.height} × {p.depth}cm · 부위 {p.parts.length}개
                  · 디자인 {p.decals.length}개
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
                  고정해 보관합니다. 가격·납기·샘플을 확인하기 전에는 결제나
                  발주가 확정되지 않습니다.
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
          <aside>
            <ProductPreview project={p} onMessage={setMessage} />
            <div className="at-backups">
              <button
                disabled={busy}
                onClick={() => {
                  try {
                    parseProject(p);
                    saveBlob(
                      new Blob([JSON.stringify(p)], {
                        type: "application/json",
                      }),
                      `${p.name}-complete.json`
                    );
                    setMessage(
                      "이미지와 부위가 포함된 전체 백업을 저장했습니다."
                    );
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
            </div>
            <p className="at-help">
              이 기기 저장은 브라우저 데이터 삭제 시 사라질 수 있습니다. 다른
              기기에서도 쓰려면 클라우드 저장 또는 전체 백업을 이용하세요.
            </p>
          </aside>
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
                run(async () => {
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
