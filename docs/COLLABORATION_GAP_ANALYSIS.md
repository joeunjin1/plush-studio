# Plush Studio 협업·저장 기능 점검

## 확인된 기반

Product Atelier는 이메일 OTP 기반의 고객 식별, 개인 소유 프로젝트의 낙관적 버전 저장, `atelier-assets` 비공개 버킷 업로드, 고객 요청 접수, 운영자 견적 제안·고객 수락을 이미 구현했다. `customer_request_staff` 테이블을 통한 운영자 전용 받은 편지함과 개인 경로 기반 스토리지 규칙도 존재한다.

## 현재 공백

고객 요청의 `received → reviewing → quoted → confirmed → closed` 상태는 상담·견적 흐름에는 적합하지만, 브랜드 관리자·디자이너·공장·QC의 제품 프로젝트 상태와 직접 연결되지 않는다. 기존 핵심 제조 모델에는 `projects`, `plush_designs`, `design_versions`, `bom_items`, `factory_quotes`, `samples`, `qa_inspections`, `production_orders`가 있으나, Product Atelier에서 승인된 디자인 버전을 이 모델로 승격하는 전용 프로시저와 작업 화면이 없다.

또한 현재 브라우저 업로드는 이미지(참조·그래픽) 중심이며, PDF/XLSX와 GLB 산출물의 프로젝트별 보관 메타데이터, 만료형 다운로드 URL, 자산 유형별 보존 정책이 통합되지 않았다. 기능 보강은 기존 RLS 규칙을 바꾸지 않고, 인증된 사용자의 역할·조직·프로젝트 멤버십을 확인하는 기존 함수 위에서 additive SQL과 클라이언트 워크플로를 추가한다.

## 다음 구현 원칙

| 영역 | 최소 보강 | 완료 조건 |
|---|---|---|
| 승인 전환 | Atelier 스냅샷을 프로젝트·디자인·동결 버전으로 승격 | 동일 요청의 중복 승격 차단, 변경 이력 기록 |
| 협업 | 역할별 작업 큐와 읽기 전용 Proof/자산 조회 | 브랜드 관리자·디자이너·공장·QC의 최소 권한 분리 |
| 제조 사양 | 버전 기반 BOM 편집과 Tech Pack 산출물 메타데이터 | 동결 버전 외에는 주문·QA 단계 진입 불가 |
| 자산 | 이미지·GLB·PDF·XLSX의 유형 검증과 비공개 경로 저장 | 다른 프로젝트 구성원이 아닌 사용자는 파일 접근 불가 |
| 환경 | Production 외 별도 staging 프로젝트에 마이그레이션 리허설 | Preview 쓰기가 Production 레코드에 닿지 않음 |
