from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import joblib
import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BACKEND_DIR / "ml" / "models"
RISK_MODEL_PATH = MODELS_DIR / "risk_classifier.pkl"
REVENUE_MODEL_PATH = MODELS_DIR / "revenue_regressor.pkl"
FEASIBILITY_MODEL_PATH = MODELS_DIR / "feasibility_regressor.pkl"
METADATA_PATH = MODELS_DIR / "model_metadata.json"
FEATURE_COLUMNS_PATH = MODELS_DIR / "feature_columns.json"

_predictor_instance = None


class ZonalyzePredictor:
    def __init__(self) -> None:
        self.metadata = self._load_metadata()
        self.feature_columns = self._load_feature_columns()
        self.risk_model = self._load_model(RISK_MODEL_PATH, "risk classifier")
        self.revenue_model = self._load_model(REVENUE_MODEL_PATH, "revenue regressor")
        self.feasibility_model = self._load_model(FEASIBILITY_MODEL_PATH, "feasibility regressor")

    def _load_metadata(self) -> Dict[str, Any]:
        if METADATA_PATH.exists():
            return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        return {
            "status": "metadata_missing",
            "important_note": "Model metadata file is missing. Retrain models with python -m app.ml.train_models.",
        }

    def _load_feature_columns(self) -> List[str]:
        if FEATURE_COLUMNS_PATH.exists():
            return json.loads(FEATURE_COLUMNS_PATH.read_text(encoding="utf-8"))
        columns = self.metadata.get("feature_columns")
        if isinstance(columns, list):
            return columns
        raise FileNotFoundError(
            f"Missing feature columns file: {FEATURE_COLUMNS_PATH}. Run python -m app.ml.train_models."
        )

    def _load_model(self, path: Path, label: str):
        if not path.exists():
            raise FileNotFoundError(
                f"Missing {label} model file: {path}. Run python -m app.ml.train_models or copy backend/app/ml/models from the machine that trained the models."
            )
        return joblib.load(path)

    def _feature_frame(self, features: Dict[str, Any]) -> pd.DataFrame:
        row = {}
        for column in self.feature_columns:
            value = features.get(column, 0)
            if value is None:
                value = 0
            row[column] = value
        return pd.DataFrame([row], columns=self.feature_columns)

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        X = self._feature_frame(features)
        revenue = float(self.revenue_model.predict(X)[0])
        feasibility = float(self.feasibility_model.predict(X)[0])
        risk_class = str(self.risk_model.predict(X)[0])

        risk_probabilities: Dict[str, float] = {}
        if hasattr(self.risk_model, "predict_proba"):
            probabilities = self.risk_model.predict_proba(X)[0]
            classes = list(self.risk_model.classes_)
            risk_probabilities = {
                str(cls): round(float(prob), 4) for cls, prob in zip(classes, probabilities)
            }

        recommendation = self._recommendation_from_outputs(revenue, feasibility, risk_class, risk_probabilities)

        return {
            "predicted_monthly_net_revenue": round(revenue, 2),
            "predicted_risk_class": risk_class,
            "risk_probabilities": risk_probabilities,
            "predicted_feasibility_score": round(max(0.0, min(100.0, feasibility)), 2),
            "recommendation": recommendation,
            "model_version": self.metadata.get("model_version", "unknown"),
        }

    def _recommendation_from_outputs(
        self,
        revenue: float,
        feasibility: float,
        risk_class: str,
        risk_probabilities: Dict[str, float],
    ) -> str:
        high_risk_prob = risk_probabilities.get("high", 0.0)
        low_risk_prob = risk_probabilities.get("low", 0.0)
        if revenue > 4000 and feasibility >= 68 and risk_class == "low" and low_risk_prob >= 0.45:
            return "recommended"
        if revenue < -2500 or feasibility < 42 or risk_class == "high" or high_risk_prob >= 0.55:
            return "not_recommended"
        return "borderline"


def get_predictor() -> ZonalyzePredictor:
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = ZonalyzePredictor()
    return _predictor_instance


def reset_predictor_cache() -> None:
    global _predictor_instance
    _predictor_instance = None
