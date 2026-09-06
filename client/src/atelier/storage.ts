import { supabase } from "@/lib/supabase";
import { parseProject, type Project, type Asset } from "./project";
export async function readImage(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("PNG/JPG/WebP 이미지를 10MB 이하로 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    if (img.width * img.height > 40000000)
      throw Error("이미지는 4천만 화소 이하로 올려 주세요.");
    const ratio = Math.min(1, 1200 / Math.max(img.width, img.height)),
      canvas = document.createElement("canvas");
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function imageDimensions(data: string) {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = reject;
    image.src = data;
  });
}
function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("plush-atelier", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("projects", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveLocal(project: Project) {
  const valid = parseProject(project),
    database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = database.transaction("projects", "readwrite");
      t.objectStore("projects").put(valid);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    database.close();
  }
}
export async function listLocal(): Promise<Project[]> {
  const database = await db();
  try {
    return await new Promise((resolve, reject) => {
      const r = database
        .transaction("projects")
        .objectStore("projects")
        .getAll();
      r.onsuccess = () =>
        resolve(
          r.result
            .map(parseProject)
            .sort((a: Project, b: Project) =>
              b.updatedAt.localeCompare(a.updatedAt)
            )
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    database.close();
  }
}
export async function saveCloud(project: Project) {
  if (!supabase) throw Error("클라우드 연결 설정이 필요합니다.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Error("고객 화면에서 이메일 로그인 후 저장해 주세요.");
  if (project.cloudOwner && project.cloudOwner !== user.id)
    throw Error("다른 계정의 작업입니다. 복사본을 만들어 저장해 주세요.");
  const p = parseProject(project),
    assets: Asset[] = [];
  for (const asset of p.assets) {
    const path = asset.path?.startsWith(`${user.id}/${p.id}/`)
      ? asset.path
      : `${user.id}/${p.id}/${asset.id}`;
    if (path !== asset.path) {
      if (!asset.data)
        throw Error("파일 내용이 없습니다. JSON 백업을 다시 불러오세요.");
      const blob = await (await fetch(asset.data)).blob();
      const { error } = await supabase.storage
        .from("atelier-assets")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (
        error &&
        error.message !== "The resource already exists" &&
        String((error as { statusCode?: string }).statusCode) !== "409"
      )
        throw Error("이미지 저장에 실패했습니다. 다시 시도해 주세요.");
    }
    assets.push({ id: asset.id, name: asset.name, path });
  }
  const snapshot = {
    ...p,
    assets,
    cloudOwner: user.id,
    revision: p.revision + 1,
  };
  const { data, error } = await supabase.rpc("save_atelier_project", {
    p_id: p.id,
    p_name: p.name,
    p_snapshot: snapshot,
    p_expected_revision: p.revision,
  });
  if (error)
    throw Error(
      error.message.includes("REVISION_CONFLICT")
        ? "다른 창에서 수정된 작업입니다. 최신 작업을 다시 열거나 복사본으로 저장해 주세요."
        : "클라우드 저장에 실패했습니다. DB 설정과 연결을 확인해 주세요."
    );
  const saved = {
    ...p,
    assets: p.assets.map((a, i) => ({ ...a, path: assets[i].path })),
    cloudOwner: user.id,
    revision: Number(data),
  };
  try {
    await saveLocal(saved);
  } catch {
    /* Cloud revision remains authoritative if local quota is full. */
  }
  return saved;
}
export async function listCloud() {
  if (!supabase) throw Error("클라우드 연결 설정이 필요합니다.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Error("이메일 로그인이 필요합니다.");
  const { data, error } = await supabase
    .from("atelier_projects")
    .select("id,name,revision,updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw Error("클라우드 목록을 불러오지 못했습니다.");
  return data;
}
export async function hydrate(snapshot: unknown): Promise<Project> {
  const p = parseProject(snapshot);
  if (!supabase) return p;
  const assets: Asset[] = [];
  for (const a of p.assets) {
    if (a.data) {
      assets.push(a);
      continue;
    }
    if (!a.path) throw Error("저장된 파일 경로가 없습니다.");
    const { data, error } = await supabase.storage
      .from("atelier-assets")
      .download(a.path);
    if (error)
      throw Error(
        "이미지 복구에 실패했습니다. 파일 접근 권한을 확인해 주세요."
      );
    const image = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(data);
    });
    assets.push({ ...a, data: image });
  }
  return { ...p, assets };
}
export async function openCloud(id: string) {
  if (!supabase) throw Error("클라우드 연결 설정이 필요합니다.");
  const { data, error } = await supabase
    .from("atelier_projects")
    .select("snapshot,revision")
    .eq("id", id)
    .single();
  if (error) throw Error("작업을 열지 못했습니다.");
  return hydrate({ ...data.snapshot, revision: data.revision });
}
export async function splitThreeView(file: File) {
  const data = await readImage(file),
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = data;
    });
  if (img.width < img.height * 1.5)
    throw Error(
      "가로로 정면·옆면·뒷면이 배치된 삼면도를 선택해 주세요. 세로 도안은 각 면을 따로 올려 주세요."
    );
  return [0, 1, 2].map(index => {
    const c = document.createElement("canvas");
    c.width = Math.floor(img.width / 3);
    c.height = img.height;
    c.getContext("2d")!.drawImage(
      img,
      (index * img.width) / 3,
      0,
      img.width / 3,
      img.height,
      0,
      0,
      c.width,
      c.height
    );
    return c.toDataURL("image/webp", 0.95);
  });
}
