import { AlertTriangle, CheckCircle2, Download, FileText, Sparkles } from "lucide-react";
import { buildDesignProof } from "./designProof";
import { getTemplate, templatesFor, type TemplateId } from "./productDefinition";
import type { Project } from "./project";

export function TemplatePanel({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (templateId: TemplateId) => void;
}) {
  return (
    <section className="at-template-panel" aria-label="제품 템플릿 선택">
      <div className="at-section-heading">
        <span>01 · PRODUCT TEMPLATE</span>
        <h3>만들 제품의 구조를 먼저 고르세요</h3>
        <p>템플릿에는 실제 구성 부위, 권장 치수, 소재 슬롯과 인쇄 안전 영역이 포함됩니다.</p>
      </div>
      <div className="at-template-grid">
        {templatesFor(project.product).map(template => (
          <button
            className="at-template-card"
            aria-pressed={project.templateId === template.id}
            key={template.id}
            onClick={() => onSelect(template.id)}
          >
            <b>{template.label}</b>
            <span>{template.description}</span>
            <small>{template.dimensions.width} × {template.dimensions.height} × {template.dimensions.depth}cm 기본형</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ProductSettingsPanel({
  project,
  onParameters,
  onMaterials,
}: {
  project: Project;
  onParameters: (parameters: Project["parameters"]) => void;
  onMaterials: (materials: Project["materials"]) => void;
}) {
  const template = getTemplate(project.templateId!);
  return (
    <section className="at-configuration-panel">
      <div className="at-section-heading">
        <span>02 · STRUCTURE & MATERIAL</span>
        <h3>{template.label}의 구조와 소재</h3>
        <p>선택값은 3D 구조와 Design Proof에 함께 기록됩니다.</p>
      </div>
      {template.parameters.length > 0 && (
        <div className="at-parameter-grid">
          {template.parameters.map(parameter => (
            <label className="at-field" key={parameter.key}>
              <span>{parameter.label}{parameter.unit ? ` (${parameter.unit})` : ""}</span>
              {parameter.options ? (
                <select
                  value={String(project.parameters[parameter.key] ?? "")}
                  onChange={event => onParameters({ ...project.parameters, [parameter.key]: event.target.value })}
                >
                  {parameter.options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input
                  inputMode="decimal"
                  max={parameter.max}
                  min={parameter.min}
                  step={parameter.step ?? 1}
                  type="number"
                  value={Number(project.parameters[parameter.key] ?? parameter.min ?? 0)}
                  onChange={event => onParameters({ ...project.parameters, [parameter.key]: Number(event.target.value) })}
                />
              )}
            </label>
          ))}
        </div>
      )}
      <div className="at-material-grid">
        {template.materialSlots.map(slot => (
          <label className="at-field" key={slot.id}>
            <span>{slot.label}</span>
            <select
              value={project.materials[slot.id] ?? ""}
              onChange={event => onMaterials({ ...project.materials, [slot.id]: event.target.value })}
            >
              {slot.options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            <div className="at-material-swatches" aria-label={`${slot.label} 빠른 선택`}>
              {slot.options.map(option => (
                <button
                  aria-pressed={project.materials[slot.id] === option.value}
                  className="at-material-swatch"
                  key={option.value}
                  onClick={() => onMaterials({ ...project.materials, [slot.id]: option.value })}
                  type="button"
                >
                  <i className={`at-material-tone at-material-tone-${option.value}`} />
                  {option.label}
                </button>
              ))}
            </div>
            <small className="at-material-note">{slot.options.find(option => option.value === project.materials[slot.id])?.note}</small>
          </label>
        ))}
      </div>
    </section>
  );
}

export function DesignProofPanel({ project, onMessage }: { project: Project; onMessage: (message: string) => void }) {
  const proof = buildDesignProof(project);
  const download = () => {
    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name}-design-proof.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onMessage("Design Proof JSON을 저장했습니다. PNG·GLB와 함께 전달해 주세요.");
  };
  const statusLabel = proof.status === "DESIGN_READY" ? "Design Ready" : proof.status === "CONCEPT" ? "Concept · 보완 권장" : "Review Required";
  return (
    <section className="at-proof" aria-label="Design Proof">
      <div className="at-proof-heading">
        <div>
          <span>05 · DESIGN PROOF</span>
          <h2>고객용 디자인 증명</h2>
          <p>선택한 구조·소재·그래픽과 자동 검토 결과를 하나의 버전으로 확인합니다.</p>
        </div>
        <span className={`at-proof-status at-proof-status-${proof.status.toLowerCase()}`}>{statusLabel}</span>
      </div>
      <div className="at-proof-id">
        <b>{proof.proofId}</b>
        <span>Revision {proof.revision} · {new Date(proof.updatedAt).toLocaleString()}</span>
      </div>
      <div className="at-proof-grid">
        <article>
          <small>PRODUCT</small>
          <b>{proof.productLabel} · {proof.templateLabel}</b>
          <span>{proof.dimensions}</span>
        </article>
        <article>
          <small>COMPONENTS</small>
          <b>{proof.parts.length}개 구조 부위</b>
          <span>{proof.parts.map(part => part.name).join(" · ") || "기본 패널형"}</span>
        </article>
        <article>
          <small>ARTWORK</small>
          <b>{proof.artworkCount}개 그래픽</b>
          <span>인쇄 안전 영역과 배치 규칙을 함께 확인합니다.</span>
        </article>
      </div>
      <div className="at-proof-materials">
        <b>소재 선택</b>
        <span>{proof.materials.map(material => `${material.label}: ${material.value}`).join(" · ")}</span>
      </div>
      <div className="at-readiness-list">
        {proof.issues.length === 0 ? (
          <p className="at-readiness-success"><CheckCircle2 size={17} /> 자동 검사 항목을 통과했습니다. 다음 단계에서 전문 검토를 요청할 수 있습니다.</p>
        ) : proof.issues.map(issue => (
          <article className={`at-readiness-item at-readiness-${issue.level}`} key={issue.code}>
            {issue.level === "error" ? <AlertTriangle size={17} /> : <Sparkles size={17} />}
            <div><b>{issue.title}</b><span>{issue.remedy}</span></div>
          </article>
        ))}
      </div>
      <p className="at-proof-disclaimer">{proof.disclaimer}</p>
      <div className="at-proof-actions">
        <button onClick={() => window.print()}><FileText size={16} /> 인쇄 · PDF 저장</button>
        <button className="at-primary" onClick={download}><Download size={16} /> Proof JSON 저장</button>
      </div>
    </section>
  );
}
