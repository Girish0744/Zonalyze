export type OperatingProfileRange = {
  low?: number | null;
  median?: number | null;
  high?: number | null;
  unit: string;
  display_value: string;
};

export type OperatingProfileSection = {
  key: string;
  title: string;
  status: string;
  estimate_type: string;
  confidence: string;
  range?: OperatingProfileRange | null;
  summary: string;
  reasoning: string[];
  evidence_used: string[];
  limitations: string[];
};

export type OperatingProfileRequest = {
  municipality_name: string;
  radius_km: number;
  business_query?: string | null;
  business_subcategory?: string | null;
  business_resolution?: Record<string, unknown> | null;
  model?: string | null;
};

export type OperatingProfileResponse = {
  status: string;
  municipality_name: string;
  business_query?: string | null;
  business_subcategory?: string | null;
  normalized_business_name?: string | null;
  radius_km: number;
  source_method: string;
  cache_status: string;
  model?: string | null;
  overall_confidence: string;
  user_facing_note: string;
  sections: OperatingProfileSection[];
  warnings: string[];
  next_data_needed: string[];
  raw_ai_available: boolean;
  raw_ai_error?: string | null;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function generateOperatingProfile(
  payload: OperatingProfileRequest,
): Promise<OperatingProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/business/operating-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Operating profile failed with status ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  return response.json();
}
