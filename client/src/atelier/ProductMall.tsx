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
        <h2>실사 5면 기준 상품을 고르세요</h2>
        <p>선택한 상품에 등록된 개인화 방식과 안전 영역만 다음 단계에서 안내합니다.</p>
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
              <span><PackageCheck size={15} /> {product.personalizationProfileIds.length}개 개인화 방식</span>
            </div>
            <button className="at-primary" onClick={() => onSelect(product)}>
              이 상품 개인화하기 <ArrowRight size={16} />
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
