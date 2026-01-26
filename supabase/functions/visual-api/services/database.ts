// Supabase Database Service - PostgreSQL queries for visual regression

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface Baseline {
  id: string;
  project_id: string;
  name: string;
  source_url?: string;
  figma_file_key?: string;
  figma_node_ids?: string[];
  viewport_json: { width: number; height: number };
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  baseline_id: string;
  status: "PASS" | "FAIL" | "ERROR";
  error_code?: string;
  mismatch_pixel_count: number;
  total_pixels: number;
  mismatch_percent: number;
  viewport_json: { width: number; height: number };
  created_at: string;
}

export interface Artifact {
  id: string;
  run_id?: string;
  baseline_id?: string;
  type: "baseline" | "current" | "diff";
  storage_path: string;
  storage_bucket: string;
  created_at: string;
}

/**
 * Create a new baseline
 */
export async function createBaseline(baseline: {
  project_id: string;
  name: string;
  source_url?: string;
  figma_file_key?: string;
  figma_node_ids?: string[];
  viewport_json: { width: number; height: number };
}): Promise<Baseline> {
  const { data, error } = await supabase
    .from("baselines")
    .insert(baseline)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create baseline: ${error.message}`);
  }

  return data;
}

/**
 * Get baseline by ID
 */
export async function getBaseline(id: string): Promise<Baseline | null> {
  const { data, error } = await supabase
    .from("baselines")
    .select()
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to get baseline: ${error.message}`);
  }

  return data;
}

/**
 * List baselines for a project
 */
export async function listBaselines(projectId: string): Promise<Baseline[]> {
  const { data, error } = await supabase
    .from("baselines")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list baselines: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a new run
 */
export async function createRun(run: {
  baseline_id: string;
  status: "PASS" | "FAIL" | "ERROR";
  error_code?: string;
  mismatch_pixel_count: number;
  total_pixels: number;
  mismatch_percent: number;
  viewport_json: { width: number; height: number };
}): Promise<Run> {
  const { data, error } = await supabase
    .from("runs")
    .insert(run)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create run: ${error.message}`);
  }

  return data;
}

/**
 * Get run by ID
 */
export async function getRun(id: string): Promise<Run | null> {
  const { data, error } = await supabase
    .from("runs")
    .select()
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get run: ${error.message}`);
  }

  return data;
}

/**
 * List runs for a baseline
 */
export async function listRuns(baselineId: string): Promise<Run[]> {
  const { data, error } = await supabase
    .from("runs")
    .select()
    .eq("baseline_id", baselineId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list runs: ${error.message}`);
  }

  return data || [];
}

/**
 * Create artifact record
 */
export async function createArtifact(artifact: {
  run_id?: string;
  baseline_id?: string;
  type: "baseline" | "current" | "diff";
  storage_path: string;
  storage_bucket: string;
}): Promise<Artifact> {
  const { data, error } = await supabase
    .from("artifacts")
    .insert(artifact)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create artifact: ${error.message}`);
  }

  return data;
}

/**
 * Get artifacts for a run
 */
export async function getArtifactsForRun(runId: string): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from("artifacts")
    .select()
    .eq("run_id", runId);

  if (error) {
    throw new Error(`Failed to get artifacts: ${error.message}`);
  }

  return data || [];
}

/**
 * Get baseline artifact
 */
export async function getBaselineArtifact(
  baselineId: string
): Promise<Artifact | null> {
  const { data, error } = await supabase
    .from("artifacts")
    .select()
    .eq("baseline_id", baselineId)
    .eq("type", "baseline")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get baseline artifact: ${error.message}`);
  }

  return data;
}
