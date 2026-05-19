// frontend/src/services/api.ts

const API_BASE = "http://127.0.0.1:8000";

// ── Type Definitions (mirror backend Pydantic schemas) ──

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
    indicator: string;        // "green" | "yellow" | "red"
    summary_text: string;
    metrics: MetricItem[];
    meta: Record<string, string>;
}

export interface MonitorStatus {
    name: string;
    value: string;
    indicator: string;        // "green" | "yellow" | "red"
}

export interface DashboardSummaryResponse {
    application_name: string;
    project_phase: string;
    selected_zone: string;
    selected_business_type: string;
    radius_km: number;
    people_location_packet: SensorPacket;
    competition_monitor: MonitorStatus;
    revenue_monitor: MonitorStatus;
    risk_monitor: MonitorStatus;
}

export interface AnalyzeScenarioRequest {
    selected_zone: string;
    selected_business_type: string;
    radius_km: number;
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

// ── API Functions ──

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
    const res = await fetch(`${API_BASE}/dashboard-summary`);
    if (!res.ok) throw new Error(`Failed to fetch dashboard summary: ${res.status}`);
    return res.json();
}

export async function analyzeScenario(
    request: AnalyzeScenarioRequest
): Promise<DashboardSummaryResponse> {
    const res = await fetch(`${API_BASE}/analyze-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`Failed to analyze scenario: ${res.status}`);
    return res.json();
}

export async function fetchRegisteredSensors(): Promise<RegisteredSensorsResponse> {
    const res = await fetch(`${API_BASE}/bus/registered-sensors`);
    if (!res.ok) throw new Error(`Failed to fetch sensors: ${res.status}`);
    return res.json();
}

export async function fetchLatestPacket(sensorType: string): Promise<SensorPacket | null> {
    const res = await fetch(`${API_BASE}/bus/latest/${sensorType}`);
    if (!res.ok) throw new Error(`Failed to fetch latest packet: ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

export async function fetchPacketHistory(sensorType: string): Promise<PacketHistoryResponse> {
    const res = await fetch(`${API_BASE}/bus/history/${sensorType}`);
    if (!res.ok) throw new Error(`Failed to fetch packet history: ${res.status}`);
    return res.json();
}

export async function checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
}

export async function checkDatabase(): Promise<DbCheckResponse> {
    const res = await fetch(`${API_BASE}/db-check`);
    if (!res.ok) throw new Error(`DB check failed: ${res.status}`);
    return res.json();
}

// ── Helpers ──

export const AVAILABLE_ZONES = [
    "Waterloo Region",
    "Kitchener Downtown",
    "Cambridge",
] as const;

export const BUSINESS_TYPE_MAP: Record<string, string> = {
    coffee: "Coffee Shop",
    fitness: "Fitness Center",
    retail: "Retail Store",
};

export function getIndicatorColor(indicator: string): string {
    switch (indicator) {
        case "green": return "text-emerald-400";
        case "yellow": return "text-accent";
        case "red": return "text-destructive";
        default: return "text-muted-foreground";
    }
}

export function getIndicatorBg(indicator: string): string {
    switch (indicator) {
        case "green": return "bg-emerald-400/10 border-emerald-400/30";
        case "yellow": return "bg-accent/10 border-accent/30";
        case "red": return "bg-destructive/10 border-destructive/30";
        default: return "bg-white/5 border-white/10";
    }
}
