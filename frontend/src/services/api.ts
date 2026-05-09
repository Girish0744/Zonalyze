// frontend/src/services/api.ts

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export interface MetricItem {
  key: string;
  label: string;
  value: number;
  unit: string;
}

export interface SensorPacket {
  timestamp: string;
  device_name: string;
  sensor_type: string;
  selected_zone: string;
  selected_business_type: string;
  radius_km: number;
  indicator: string;
  summary_text: string;
  metrics: MetricItem[];
  meta: Record<string, string>;
}

export interface MonitorStatus {
  name: string;
  value: string;
  indicator: string;
}

export interface MLPredictionResponse {
  predicted_risk_class: string;
  risk_probabilities: Record<string, number>;
  predicted_monthly_net_revenue: number;
  predicted_feasibility_score: number;
  recommendation: string;
}

export interface ModuleAnalysisResponse {
  score: number;
  level: string;
  summary: string;
  signals: string[];
  metrics: Record<string, number>;
}

export interface AnalysisBreakdownResponse {
  demand_analysis: ModuleAnalysisResponse;
  competition_analysis: ModuleAnalysisResponse;
  lease_cost_analysis: ModuleAnalysisResponse;
}

export interface PredictionExplanationResponse {
  competition_score: number;
  demand_score: number;
  demographic_fit_score: number;
  estimated_competitor_count: number;
  reachable_population_estimate: number;
  monthly_lease_cost_estimate: number;
  monthly_operating_cost_estimate: number;
  revenue_explanation: string;
  risk_explanation: string;
  feasibility_explanation: string;
  top_positive_factors: string[];
  top_negative_factors: string[];
}

export interface DashboardSummaryResponse {
  application_name: string;
  project_phase: string;
  municipality_name: string;
  business_subcategory: string;
  radius_km: number;
  people_location_packet: SensorPacket;
  competition_monitor: MonitorStatus;
  revenue_monitor: MonitorStatus;
  risk_monitor: MonitorStatus;
  ml_prediction: MLPredictionResponse | null;
  prediction_explanation: PredictionExplanationResponse | null;
  analysis_breakdown: AnalysisBreakdownResponse | null;
}

export interface AnalyzeScenarioRequest {
  municipality_name: string;
  business_subcategory: string;
  radius_km: number;
}

export interface FeasibilityReportResponse {
  filename: string;
  content_type: string;
  report_text: string;
}


export interface ModelFileStatusResponse {
  risk_classifier: boolean;
  revenue_regressor: boolean;
  feasibility_regressor: boolean;
  metadata: boolean;
}

export interface ModelStatusResponse {
  status: string;
  trained_at: string | null;
  dataset_path: string | null;
  row_count: number;
  feature_count: number;
  categorical_feature_count: number;
  numeric_feature_count: number;
  targets: Record<string, string>;
  risk_accuracy: number | null;
  revenue_mae: number | null;
  revenue_rmse: number | null;
  revenue_r2: number | null;
  feasibility_mae: number | null;
  feasibility_rmse: number | null;
  feasibility_r2: number | null;
  model_files: ModelFileStatusResponse;
  important_note: string;
}

export interface ValidationCheckResponse {
  name: string;
  status: string;
  message: string;
}

export interface SystemValidationResponse {
  overall_status: string;
  passed_checks: number;
  total_checks: number;
  checks: ValidationCheckResponse[];
}

export interface MunicipalityOption {
  municipality_name: string;
  municipality_type: string;
  label: string;
}

export interface MunicipalitiesResponse {
  municipalities: MunicipalityOption[];
}

export interface BusinessSubcategoryOption {
  business_category: string;
  business_subcategory: string;
  label: string;
}

export interface BusinessSubcategoriesResponse {
  business_subcategories: BusinessSubcategoryOption[];
}

export interface RegisteredSensorsResponse {
  sensors: Record<string, string>;
}

export interface PacketHistoryResponse {
  sensor_type: string;
  count: number;
  packets: SensorPacket[];
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface DbCheckResponse {
  database_connected: boolean;
  message: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {
      details = "";
    }
    throw new Error(
      `${res.status} ${res.statusText}${details ? ` — ${details}` : ""}`,
    );
  }

  return res.json() as Promise<T>;
}

export function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  return requestJson<DashboardSummaryResponse>(`${API_BASE}/dashboard-summary`);
}

export function analyzeScenario(
  request: AnalyzeScenarioRequest,
): Promise<DashboardSummaryResponse> {
  return requestJson<DashboardSummaryResponse>(`${API_BASE}/analyze-scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export function generateFeasibilityReport(
  request: AnalyzeScenarioRequest,
): Promise<FeasibilityReportResponse> {
  return requestJson<FeasibilityReportResponse>(
    `${API_BASE}/reports/feasibility`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}


export function fetchModelStatus(): Promise<ModelStatusResponse> {
  return requestJson<ModelStatusResponse>(`${API_BASE}/ml/model-status`);
}

export function runSystemValidation(): Promise<SystemValidationResponse> {
  return requestJson<SystemValidationResponse>(`${API_BASE}/validation/system`);
}

export function fetchMunicipalities(): Promise<MunicipalitiesResponse> {
  return requestJson<MunicipalitiesResponse>(`${API_BASE}/municipalities`);
}

export function fetchBusinessSubcategories(): Promise<BusinessSubcategoriesResponse> {
  return requestJson<BusinessSubcategoriesResponse>(
    `${API_BASE}/business-subcategories`,
  );
}

export function fetchRegisteredSensors(): Promise<RegisteredSensorsResponse> {
  return requestJson<RegisteredSensorsResponse>(
    `${API_BASE}/bus/registered-sensors`,
  );
}

export async function fetchLatestPacket(
  sensorType: string,
): Promise<SensorPacket | null> {
  const res = await fetch(`${API_BASE}/bus/latest/${sensorType}`);
  if (!res.ok) throw new Error(`Failed to fetch latest packet: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function fetchPacketHistory(
  sensorType: string,
): Promise<PacketHistoryResponse> {
  return requestJson<PacketHistoryResponse>(
    `${API_BASE}/bus/history/${sensorType}`,
  );
}

export function checkHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>(`${API_BASE}/health`);
}

export function checkDatabase(): Promise<DbCheckResponse> {
  return requestJson<DbCheckResponse>(`${API_BASE}/db-check`);
}

export function getIndicatorColor(indicator: string): string {
  switch (indicator) {
    case "green":
      return "text-emerald-400";
    case "yellow":
      return "text-accent";
    case "red":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

export function getIndicatorBg(indicator: string): string {
  switch (indicator) {
    case "green":
      return "bg-emerald-400/10 border-emerald-400/30";
    case "yellow":
      return "bg-accent/10 border-accent/30";
    case "red":
      return "bg-destructive/10 border-destructive/30";
    default:
      return "bg-white/5 border-white/10";
  }
}
