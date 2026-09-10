import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { Boxes, FileUp, HardDrive, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buyerMagicLinkErrorMessage,
  catalogAdminMagicLinkRedirectUrl,
} from "./buyerAccess";
import {
  analyzeOwnerGlb,
  ownerGlbMimeType,
  ownerGlbPerformanceMessage,
  ownerModelStoragePath,
  sha256ForBytes,
  validateOwnerGlbFile,
  type OwnerGlbAnalysis,
} from "./ownerModelRegistration";
import "./catalogModelAdmin.css";

type Organization = { id: string; name: string; slug: string };
type Product = {
  id: string;
  organization_id: string;
  sku: string;
  title: string;
  review_status: string;
  visible_to_buyers: boolean;
};
type ModelRow = {
  id: string;
  reference_product_id: string;
  model_version: string;
  source_filename: string;
  byte_size: number;
  triangle_count: number | null;
  review_state: string;
  checksum_verification_state: string;
  is_current: boolean;
  visible_to_buyers: boolean;
  uploaded_at: string;
};

function numberLabel(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function bytesLabel(value: number) {
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function readableError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export default function CatalogModelAdmin({ user }: { user: User | null }) {
  const [email, setEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [productId, setProductId] = useState("");
  const [modelVersion, setModelVersion] = useState("v01");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<OwnerGlbAnalysis | null>(null);
  const [checksum, setChecksum] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [migrationReady, setMigrationReady] = useState(true);

  const organizationProducts = useMemo(
    () => products.filter(product => product.organization_id === organizationId),
    [organizationId, products]
  );
  const productModels = useMemo(
    () => models.filter(model => model.reference_product_id === productId),
    [models, productId]
  );
  const versionExists = productModels.some(model => model.model_version.toLowerCase() === modelVersion.trim().toLowerCase());

  const load = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setMessage("");
    try {
      const { data: membershipRows, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id, organizations ( id, name, slug )")
        .eq("user_id", user.id)
        .eq("role", "brand_admin");
      if (membershipError) throw membershipError;
      const nextOrganizations: Organization[] = (membershipRows ?? []).flatMap(row => {
        const organization = row.organizations;
        if (Array.isArray(organization)) return organization;
        return organization ? [organization] : [];
      }) as Organization[];
      setOrganizations(nextOrganizations);
      setOrganizationId(current => nextOrganizations.some(org => org.id === current) ? current : nextOrganizations[0]?.id ?? "");

      const orgIds = nextOrganizations.map(org => org.id);
      if (orgIds.length === 0) {
        setProducts([]);
        setModels([]);
        setMessage("brand_admin 권한이 연결된 조직이 없습니다. 조직 멤버 권한을 먼저 확인하세요.");
        return;
      }
      const { data: productRows, error: productError } = await supabase
        .from("reference_products")
        .select("id, organization_id, sku, title, review_status, visible_to_buyers")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false });
      if (productError) throw productError;
      setProducts((productRows ?? []) as Product[]);

      const { data: modelRows, error: modelError } = await supabase
        .from("reference_product_models")
        .select("id, reference_product_id, model_version, source_filename, byte_size, triangle_count, review_state, checksum_verification_state, is_current, visible_to_buyers, uploaded_at")
        .order("uploaded_at", { ascending: false });
      if (modelError) {
        if (modelError.code === "42P01") {
          setMigrationReady(false);
          setModels([]);
          setMessage("staging DB에 migration 012를 적용하면 GLB 메타데이터 등록을 시작할 수 있습니다.");
          return;
        }
        throw modelError;
      }
      setMigrationReady(true);
      setModels((modelRows ?? []) as ModelRow[]);
    } catch (error) {
      setMessage(readableError(error, "관리자 상품 마스터 정보를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  useEffect(() => {
    setProductId(current => organizationProducts.some(product => product.id === current) ? current : organizationProducts[0]?.id ?? "");
  }, [organizationProducts]);

  const sendAdminMagicLink = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: catalogAdminMagicLinkRedirectUrl() },
      });
      setMessage(error ? buyerMagicLinkErrorMessage(error) : "관리자 로그인 링크를 이메일로 보냈습니다. 인증 후 이 화면으로 돌아옵니다.");
    } catch {
      setMessage("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setAuthBusy(false);
    }
  };

  const selectFile = async (selectedFile: File | undefined) => {
    setFile(null);
    setAnalysis(null);
    setChecksum("");
    if (!selectedFile) return;
    try {
      validateOwnerGlbFile(selectedFile);
      const bytes = await selectedFile.arrayBuffer();
      const nextAnalysis = analyzeOwnerGlb(bytes);
      const nextChecksum = await sha256ForBytes(bytes);
      setFile(selectedFile);
      setAnalysis(nextAnalysis);
      setChecksum(nextChecksum);
      setMessage(ownerGlbPerformanceMessage(selectedFile, nextAnalysis));
    } catch (error) {
      setMessage(readableError(error, "GLB 파일을 읽지 못했습니다."));
    }
  };

  const submitDraft = async () => {
    if (!supabase || !user || !file || !analysis || !checksum || !organizationId || !productId) return;
    if (!migrationReady) {
      setMessage("migration 012를 staging DB에 적용한 뒤 다시 시도해 주세요.");
      return;
    }
    if (versionExists) {
      setMessage("같은 SKU에 동일한 모델 버전이 이미 있습니다. 새 버전을 입력하세요.");
      return;
    }
    setUploading(true);
    setMessage("private 원본을 올리고 초안 메타데이터를 등록하는 중…");
    const path = ownerModelStoragePath(organizationId, modelVersion, file.name);
    try {
      const { error: uploadError } = await supabase.storage
        .from("plush-studio")
        .upload(path, file, { contentType: ownerGlbMimeType, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("reference_product_models")
        .insert({
          reference_product_id: productId,
          model_version: modelVersion.trim(),
          source_type: "seller_supplied",
          source_filename: file.name,
          source_storage_bucket: "plush-studio",
          source_storage_path: path,
          mime_type: ownerGlbMimeType,
          byte_size: file.size,
          checksum_sha256: checksum,
          checksum_verification_state: "pending",
          mesh_count: analysis.meshCount,
          triangle_count: analysis.triangleCount,
          material_count: analysis.materialCount,
          embedded_texture_count: analysis.embeddedTextureCount,
          has_animations: analysis.hasAnimations,
          model_metadata: { glb_version: 2, performance_review_required: Boolean(file.size > 8 * 1024 * 1024 || analysis.triangleCount > 75_000) },
          review_state: "draft",
          uploaded_by: user.id,
        });
      if (insertError) {
        await supabase.storage.from("plush-studio").remove([path]);
        throw insertError;
      }
      setFile(null);
      setAnalysis(null);
      setChecksum("");
      setMessage("private 원본과 초안 메타데이터를 등록했습니다. 해시 확인·5면 비교·공개 승인 전에는 구매자에게 노출되지 않습니다.");
      await load();
    } catch (error) {
      setMessage(readableError(error, "GLB 초안 등록에 실패했습니다. 공개 카탈로그에는 반영되지 않았습니다."));
    } finally {
      setUploading(false);
    }
  };

  if (!supabase) {
    return <section className="at-model-admin at-model-admin-empty"><h1>관리자 상품 마스터를 준비 중입니다.</h1><p>staging Supabase 공개 환경 구성이 필요합니다.</p></section>;
  }

  if (!user) {
    return (
      <main className="at-model-admin">
        <section className="at-model-admin-login" aria-labelledby="catalog-admin-login-title">
          <LockKeyhole size={22} />
          <p>PRIVATE ADMIN ACCESS</p>
          <h1 id="catalog-admin-login-title">상품 마스터 · 3D 원본 등록</h1>
          <span>공개 상품 화면에는 표시되지 않습니다. 조직의 brand_admin 이메일로 인증해야 합니다.</span>
          <form onSubmit={event => { event.preventDefault(); void sendAdminMagicLink(); }}>
            <label htmlFor="catalog-admin-email">관리자 이메일</label>
            <input autoComplete="email" id="catalog-admin-email" inputMode="email" onChange={event => setEmail(event.target.value)} placeholder="name@company.com" required type="email" value={email} />
            <button className="at-primary" disabled={authBusy} type="submit">{authBusy ? "링크 전송 중…" : "관리자 로그인 링크 받기"}</button>
          </form>
          {message && <p aria-live="polite" className="at-model-admin-message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="at-model-admin">
      <header className="at-model-admin-header">
        <div><span>STAGING · PRIVATE INTAKE</span><h1>상품 마스터 · 3D 원본 등록</h1><p>원본 GLB는 private storage에만 보관하고, 검토·해시 확인·승인 전에는 구매자에게 노출하지 않습니다.</p></div>
        <button className="at-secondary" disabled={loading} onClick={() => void load()} type="button"><RefreshCw size={16} /> {loading ? "불러오는 중…" : "새로고침"}</button>
      </header>

      <section className="at-model-admin-guard" aria-label="공개 전 검토 기준"><ShieldCheck size={19} /><p><b>공개 게이트:</b> 상품 권리·상품 승인, GLB SHA-256 확인, 5면 비교, 모델 검토, public catalog 승인 복사본이 모두 완료돼야 현재 구매자 3D 모델로 승격할 수 있습니다.</p></section>
      {message && <p aria-live="polite" className="at-model-admin-message">{message}</p>}

      <div className="at-model-admin-layout">
        <section className="at-model-admin-card" aria-labelledby="model-draft-title">
          <div className="at-model-admin-card-heading"><FileUp size={20} /><div><span>01 · DRAFT INTAKE</span><h2 id="model-draft-title">대표 제공 GLB 초안 등록</h2></div></div>
          <div className="at-model-admin-fields">
            <label><span>소유 조직</span><select disabled={uploading || organizations.length === 0} onChange={event => setOrganizationId(event.target.value)} value={organizationId}><option value="">조직을 선택하세요</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name} · {org.slug}</option>)}</select></label>
            <label><span>대상 상품 SKU</span><select disabled={uploading || organizationProducts.length === 0} onChange={event => setProductId(event.target.value)} value={productId}><option value="">상품을 선택하세요</option>{organizationProducts.map(product => <option key={product.id} value={product.id}>{product.sku} · {product.title}</option>)}</select></label>
            <label><span>새 모델 버전</span><input disabled={uploading} maxLength={40} onChange={event => setModelVersion(event.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,39}" required value={modelVersion} /></label>
            <label><span>대표 제공 GLB 원본</span><input accept=".glb,model/gltf-binary" disabled={uploading} onChange={event => void selectFile(event.target.files?.[0])} type="file" /></label>
          </div>
          {file && analysis && <div className="at-model-admin-analysis"><div><span>원본</span><b>{file.name}</b><small>{bytesLabel(file.size)} · SHA-256 {checksum.slice(0, 12)}…</small></div><div><span>구조</span><b>{numberLabel(analysis.meshCount)} mesh · {numberLabel(analysis.triangleCount)} triangles</b><small>{numberLabel(analysis.materialCount)} material · {numberLabel(analysis.embeddedTextureCount)} texture · {analysis.hasAnimations ? "animation 포함" : "animation 없음"}</small></div></div>}
          <button className="at-primary at-model-admin-submit" disabled={uploading || !migrationReady || !file || !analysis || !checksum || !organizationId || !productId || versionExists} onClick={() => void submitDraft()} type="button">{uploading ? "초안 등록 중…" : versionExists ? "동일 버전이 이미 존재합니다" : "private 원본 · 초안 메타데이터 등록"}</button>
          <small className="at-model-admin-footnote">허용 형식은 GLB 2.0이며, 최대 200MB입니다. 이 단계에서는 public catalog 업로드·구매자 공개·기존 버전 대체를 수행하지 않습니다.</small>
        </section>

        <section className="at-model-admin-card" aria-labelledby="model-queue-title">
          <div className="at-model-admin-card-heading"><Boxes size={20} /><div><span>02 · REVIEW QUEUE</span><h2 id="model-queue-title">선택 SKU의 3D 버전</h2></div></div>
          {productId ? productModels.length > 0 ? <div className="at-model-admin-table" role="region" aria-label="GLB 검토 대기 목록" tabIndex={0}><table><thead><tr><th>버전</th><th>원본</th><th>검토</th><th>무결성</th><th>공개</th></tr></thead><tbody>{productModels.map(model => <tr key={model.id}><td><b>{model.model_version}</b><small>{new Date(model.uploaded_at).toLocaleDateString("ko-KR")}</small></td><td>{bytesLabel(model.byte_size)}<small>{model.triangle_count === null ? "구조 미등록" : `${numberLabel(model.triangle_count)} triangles`}</small></td><td><span className="at-model-admin-status">{model.review_state}</span></td><td><span className="at-model-admin-status">{model.checksum_verification_state}</span></td><td>{model.is_current && model.visible_to_buyers ? "현재 공개" : "비공개"}</td></tr>)}</tbody></table></div> : <div className="at-model-admin-empty"><HardDrive size={22} /><p>아직 등록된 GLB 메타데이터가 없습니다.</p><span>첫 원본을 초안으로 올린 뒤 검토 큐에서 확인하세요.</span></div> : <div className="at-model-admin-empty"><HardDrive size={22} /><p>대상 상품 SKU를 선택하세요.</p></div>}
        </section>
      </div>
    </main>
  );
}
