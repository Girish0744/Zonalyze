import { useEffect, useState } from "react";
import { fetchDashboardSummary, analyzeScenario } from "./services/api";

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    selected_zone: "Waterloo Region",
    selected_business_type: "Coffee Shop",
    radius_km: 5,
  });

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await fetchDashboardSummary();
        setDashboardData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "radius_km" ? Number(value) : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data = await analyzeScenario(formData);
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <h1>Zonalyze</h1>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1>{dashboardData.application_name}</h1>
      <p><strong>Project Phase:</strong> {dashboardData.project_phase}</p>
      <p><strong>Selected Zone:</strong> {dashboardData.selected_zone}</p>
      <p><strong>Business Type:</strong> {dashboardData.selected_business_type}</p>
      <p><strong>Radius:</strong> {dashboardData.radius_km} km</p>

      <section style={styles.section}>
        <h2>Scenario Input</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label>Zone</label>
            <input
              type="text"
              name="selected_zone"
              value={formData.selected_zone}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label>Business Type</label>
            <input
              type="text"
              name="selected_business_type"
              value={formData.selected_business_type}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label>Radius (km)</label>
            <input
              type="number"
              name="radius_km"
              value={formData.radius_km}
              onChange={handleChange}
              min="0.5"
              max="50"
              step="0.5"
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.button} disabled={submitting}>
            {submitting ? "Analyzing..." : "Analyze Scenario"}
          </button>
        </form>
      </section>

      {error && (
        <p style={{ color: "red", marginTop: "20px" }}>
          Error: {error}
        </p>
      )}

      <section style={styles.section}>
        <h2>Monitor Overview</h2>

        <div style={styles.grid}>
          <PeopleLocationCard packet={dashboardData.people_location_packet} />
          <MonitorCard monitor={dashboardData.competition_monitor} />
          <MonitorCard monitor={dashboardData.revenue_monitor} />
          <MonitorCard monitor={dashboardData.risk_monitor} />
        </div>
      </section>
    </div>
  );
}

function PeopleLocationCard({ packet }) {
  const indicatorColor = getIndicatorColor(packet.indicator);

  return (
    <div style={styles.card}>
      <h3>People & Location</h3>
      <p>{packet.summary_text}</p>
      <p>
        <strong>Status:</strong>{" "}
        <span style={{ color: indicatorColor }}>{packet.indicator}</span>
      </p>

      <div style={{ marginTop: "12px" }}>
        {packet.metrics.map((metric) => (
          <div key={metric.key} style={{ marginBottom: "8px" }}>
            <strong>{metric.label}:</strong> {metric.value} {metric.unit}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonitorCard({ monitor }) {
  const indicatorColor = getIndicatorColor(monitor.indicator);

  return (
    <div style={styles.card}>
      <h3>{monitor.name}</h3>
      <p>{monitor.value}</p>
      <p>
        <strong>Status:</strong>{" "}
        <span style={{ color: indicatorColor }}>{monitor.indicator}</span>
      </p>
    </div>
  );
}

function getIndicatorColor(indicator) {
  switch (indicator) {
    case "green":
      return "green";
    case "yellow":
      return "orange";
    case "red":
      return "red";
    default:
      return "black";
  }
}

const styles = {
  page: {
    padding: "30px",
    fontFamily: "Arial, sans-serif",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  section: {
    marginTop: "30px",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr auto",
    gap: "16px",
    alignItems: "end",
    marginTop: "15px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  input: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
  },
  button: {
    padding: "10px 16px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginTop: "20px",
  },
  card: {
    border: "1px solid #ccc",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  },
};

export default App;