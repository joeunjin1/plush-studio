import { ArrowRight, PackageCheck, Rotate3D } from "lucide-react";
import type { ReferenceProduct } from "./referenceProducts";

type Props = {
  products: ReferenceProduct[];
  onSelect: (product: ReferenceProduct) => void;
};

export function ProductMall({ products, onSelect }: Props) {
  return (
    <section className="at-product-mall" aria-label="상품몰">
      <header className="at-product-mall-heading">
        <span>OFFICIAL PRODUCT MALL</span>
        <h2>실물 기준 상품에서 제작 사양을 고르세요</h2>
        <p>관리자가 승인한 컬러·개인화 방식·안전 영역만 선택할 수 있으며, 최종 생산 가능 여부는 공장 검토로 확정됩니다.</p>
      </header>
      <div className="at-product-mall-grid">
        {products.map(product => (
          <article className="at-product-mall-card" key={product.id}>
            <img alt={`${product.title} 정면 상품 이미지`} src={product.views.front.image} />
            <div>
              <span>{product.family === "plush" ? "PLUSH" : product.family.toUpperCase()}</span>
              <h3>{product.title}</h3>
              <p>{product.colorLabel}</p>
              <small>{product.sku} · 5면 기준 이미지</small>
            </div>
            <div className="at-product-mall-meta">
              <span><Rotate3D size={15} /> 5면 프리뷰</span>
              <span><PackageCheck size={15} /> {product.customizationOptions?.length ?? 0}개 SKU 옵션 · {product.personalizationProfileIds.length}개 개인화 방식</span>
            </div>
            <button className="at-primary" onClick={() => onSelect(product)}>
              사양 선택 · 제작 요청 <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
      <p className="at-product-mall-note">
        실제 상품 판매 공개 전에는 실측, 소재, 제작 방식, 권리와 샘플 승인 상태를 상품별로 확정합니다.
      </p>
    </section>
  );
}
