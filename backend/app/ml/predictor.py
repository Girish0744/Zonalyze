from pathlib import Path
from typing import Any, Dict

import joblib
import pandas as pd


MODEL_DIR = Path("app/ml/models")

RISK_MODEL_PATH = MODEL_DIR / "risk_classifier.pkl"
REVENUE_MODEL_PATH = MODEL_DIR / "revenue_regressor.pkl"
FEASIBILITY_MODEL_PATH = MODEL_DIR / "feasibility_regressor.pkl"


class ZonalyzePredictor:
    def __init__(self):
        self.risk_model = joblib.load(RISK_MODEL_PATH)
        self.revenue_model = joblib.load(REVENUE_MODEL_PATH)
        self.feasibility_model = joblib.load(FEASIBILITY_MODEL_PATH)

    def predict(self, feature_row: Dict[str, Any]) -> Dict[str, Any]:
        input_df = pd.DataFrame([feature_row])

        risk_class = self.risk_model.predict(input_df)[0]
        risk_probs = self.risk_model.predict_proba(input_df)[0]
        risk_classes = self.risk_model.classes_

        risk_probability_map = {
            str(label): round(float(prob), 4)
            for label, prob in zip(risk_classes, risk_probs)
        }

        predicted_net_revenue = float(self.revenue_model.predict(input_df)[0])
        predicted_feasibility = float(self.feasibility_model.predict(input_df)[0])

        recommendation = self._recommend(
            feasibility_score=predicted_feasibility,
            risk_class=str(risk_class),
            net_revenue=predicted_net_revenue,
        )

        return {
            "predicted_risk_class": str(risk_class),
            "risk_probabilities": risk_probability_map,
            "predicted_monthly_net_revenue": round(predicted_net_revenue, 2),
            "predicted_feasibility_score": round(predicted_feasibility, 2),
            "recommendation": recommendation,
        }

    def _recommend(
        self,
        feasibility_score: float,
        risk_class: str,
        net_revenue: float,
    ) -> str:
        if feasibility_score >= 60 and risk_class in ["low", "medium"] and net_revenue > 0:
            return "recommended"

        if feasibility_score >= 40 and risk_class != "high":
            return "borderline"

        return "not_recommended"


_predictor_instance: ZonalyzePredictor | None = None


def get_predictor() -> ZonalyzePredictor:
    global _predictor_instance

    if _predictor_instance is None:
        _predictor_instance = ZonalyzePredictor()

    return _predictor_instance