const BASE_URL = "http://127.0.0.1:8000";

export async function fetchDashboardSummary() {
  const response = await fetch(`${BASE_URL}/dashboard-summary`);

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }

  return response.json();
}

export async function analyzeScenario(payload) {
  const response = await fetch(`${BASE_URL}/analyze-scenario`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to analyze scenario");
  }

  return response.json();
}