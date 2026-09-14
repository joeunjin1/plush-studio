import { ArrowRight, PackageCheck, Rotate3D } from "lucide-react";
import type { ReferenceProduct } from "./referenceProducts";

type Props = {
  products: ReferenceProduct[];
  onSelect: (product: ReferenceProduct) => void;
  onStartFreeDesign: () => void;
};

export function ProductMall({ products, onSelect, onStartFreeDesign }: Props) {
  return (
    <section className="at-product-mall" aria-label="상품몰">
      <header className="at-product-mall-heading">
        <span>OFFICIAL REAL PRODUCT MALL</span>
        <h2>실물 기준 상품부터 고르세요</h2>
        <p>등록된 3면·5면 이미지와 대표 제공 3D 프리뷰를 먼저 확인한 뒤, 이 SKU에 허용된 사양만 선택해 공장 검토를 요청합니다.</p>
      </header>
      <section className="at-product-mall-principles" aria-label="공식 상품 주문 원칙">
        <div><Rotate3D size={18} /><span><b>실물 기준 프리뷰</b><small>등록된 다면 이미지와 승인된 3D만 표시합니다.</small></span></div>
        <div><PackageCheck size={18} /><span><b>SKU별 허용 사양</b><small>관리자가 설정한 컬러·인쇄 방식만 선택합니다.</small></span></div>
        <div><ArrowRight size={18} /><span><b>공장 검토 요청</b><small>원단·인쇄·MOQ·납기는 검토 후 확정됩니다.</small></span></div>
      </section>
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
      <footer className="at-product-mall-footer">
        <div><span>FREE 3D DESIGNER</span><p>기존 상품이 아닌 완전히 새로운 형태를 기획하시나요? 자유 설계 도구로 이동할 수 있습니다.</p></div>
        <button onClick={onStartFreeDesign} type="button">자유 3D 설계 시작 <ArrowRight size={16} /></button>
      </footer>
    </section>
  );
}
