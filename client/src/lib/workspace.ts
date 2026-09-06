import { supabase } from "@/lib/supabase";
import type { DesignPart, DesignState } from "@/lib/studioTypes";
import type { CostInputs, QuoteResult } from "@/lib/quote";

export async function saveWorkspaceSnapshot(
  design: DesignState,
  parts: DesignPart[],
  costInputs: CostInputs,
  quoteResult: QuoteResult,
) {
  if (!supabase) throw new Error("Supabase configuration is unavailable.");
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error("AUTH_REQUIRED");

  let { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, organization_id")
    .eq("code", "PLUSH-001")
    .maybeSingle();
  if (projectError) throw projectError;

  if (!project) {
    const slug = `molipop-${user.id.slice(0, 8)}`;
    const { data: organizationId, error: organizationError } = await supabase.rpc("create_organization_with_owner", {
      organization_name: "MOLIPOP Studio",
      organization_slug: slug,
    });
    if (organizationError) throw organizationError;
    const { data: createdProject, error: createProjectError } = await supabase
      .from("projects")
      .insert({ organization_id: organizationId, code: "PLUSH-001", name: design.name, brand_name: "MOLIPOP", created_by: user.id })
      .select("id, organization_id")
      .single();
    if (createProjectError) throw createProjectError;
    const { error: memberError } = await supabase
      .from("project_members")
      .insert({ project_id: createdProject.id, user_id: user.id, role: "brand_admin" });
    if (memberError) throw memberError;
    project = createdProject;
  } else {
    const { error: updateProjectError } = await supabase.from("projects").update({ name: design.name }).eq("id", project.id);
    if (updateProjectError) throw updateProjectError;
  }

  let { data: plushDesign, error: designError } = await supabase
    .from("plush_designs")
    .select("id")
    .eq("project_id", project.id)
    .maybeSingle();
  if (designError) throw designError;
  const editorState = { ...design, savedAt: new Date().toISOString() };
  if (!plushDesign) {
    const { data: createdDesign, error: createDesignError } = await supabase
      .from("plush_designs")
      .insert({ project_id: project.id, name: design.name, character_type: design.kind, final_height_cm: design.heightCm, editor_state: editorState, created_by: user.id })
      .select("id")
      .single();
    if (createDesignError) throw createDesignError;
    plushDesign = createdDesign;
  } else {
    const { error: updateDesignError } = await supabase
      .from("plush_designs")
      .update({ name: design.name, character_type: design.kind, final_height_cm: design.heightCm, editor_state: editorState })
      .eq("id", plushDesign.id);
    if (updateDesignError) throw updateDesignError;
  }

  let { data: version, error: versionError } = await supabase
    .from("design_versions")
    .select("id")
    .eq("plush_design_id", plushDesign.id)
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) {
    const { data: createdVersion, error: createVersionError } = await supabase
      .from("design_versions")
      .insert({ plush_design_id: plushDesign.id, version_number: 1, label: "V1.0", editor_snapshot: editorState, created_by: user.id })
      .select("id")
      .single();
    if (createVersionError) throw createVersionError;
    version = createdVersion;
  } else {
    const { error: updateVersionError } = await supabase
      .from("design_versions")
      .update({ editor_snapshot: editorState, change_summary: "Designer workspace save" })
      .eq("id", version.id);
    if (updateVersionError) throw updateVersionError;
  }

  const { error: clearPartsError } = await supabase.from("plush_parts").delete().eq("design_version_id", version.id);
  if (clearPartsError) throw clearPartsError;
  const { error: createPartsError } = await supabase.from("plush_parts").insert(parts.map(part => ({
    design_version_id: version.id,
    part_code: part.code,
    name: part.name,
    part_type: part.type,
    material: part.material,
    width_mm: part.widthMm,
    height_mm: part.heightMm,
    depth_mm: part.depthMm,
    notes: `Tolerance +/- ${part.toleranceMm} mm`,
  })));
  if (createPartsError) throw createPartsError;

  const { error: createCostError } = await supabase.from("cost_scenarios").insert({
    project_id: project.id,
    design_version_id: version.id,
    name: "Current workspace simulation",
    quantity: costInputs.quantity,
    exchange_rate: costInputs.exchangeRate,
    target_margin_rate: costInputs.marginRate,
    input_snapshot: costInputs,
    result_snapshot: quoteResult,
    created_by: user.id,
  });
  if (createCostError) throw createCostError;
  return { projectId: project.id, versionId: version.id };
}
