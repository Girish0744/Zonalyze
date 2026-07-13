# Zonalyze — Business Feasibility Intelligence Platform

> Evaluate whether a business idea will work at a specific location, using real Canadian census data and live map signals — before spending a dollar.

Zonalyze helps entrepreneurs assess location viability across **26 business types** in **552 Ontario municipalities**, powered by real **Statistics Canada 2021 Census** data and live **OpenStreetMap** feeds for competitors, transit access, and commercial activity.

**Status:** Capstone project, in active development (Sept 2025 – present)

---

## What it does

- **Feasibility scoring** — pick a business type and location, get a data-backed viability read instead of a gut guess.
- **Three trained ML models** working together:
  - Risk classifier — **88.14%** accuracy
  - Revenue regressor — **R² = 0.93**
  - Feasibility-score regressor — **R² = 0.99**
- **Real data pipeline** — transforms raw Statistics Canada Census Subdivision files into **45-feature**, model-ready matrices; models trained on **50,000+** records derived from real census features.
- **Live market context** — OpenStreetMap integration surfaces nearby competitors, transit, and commercial density for the chosen location.
- **Real-time architecture** — a WebSocket message bus broadcasts updates across **8 monitoring modules** in under 2 seconds.
- **AI chat** — an LLM-powered assistant for natural-language scenario analysis and business-insight Q&A.
- **Decision-ready output** — investor-ready PDF export, scenario history with multi-scenario comparison, geospatial market mapping, and token-based authentication.

---

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, WebSocket client |
| Backend | FastAPI, WebSocket, token auth |
| ML / Data | scikit-learn (Random Forest), Pandas, NumPy |
| Data sources | Statistics Canada 2021 Census, OpenStreetMap API |
| Database | PostgreSQL |
| AI | LLM-powered chat interface |
| Deployment | Docker Compose (single-command, multi-service) |

---

## Running locally

The full multi-service stack runs with Docker Compose:

```bash
git clone https://github.com/Girish0744/Zonalyze.git
cd Zonalyze
docker compose up --build
```

> Detailed environment/setup notes will be expanded as the project nears release.

---

## Team

Built by a team of four:

- [Girish Bhuteja](https://github.com/Girish0744)
- Kalp Mehta
- Shubham Patel
- Jainish Prajapati

---

## Roadmap

- [ ] Expand setup documentation and environment configuration
- [ ] Add screenshots / demo walkthrough
- [ ] Broaden coverage beyond Ontario
- [ ] Public demo deployment

---

<sub>Course capstone · Conestoga College · Bachelor of Computer Science (Honours)</sub>
