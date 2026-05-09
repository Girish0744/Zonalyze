import json
from pathlib import Path
from typing import Any, Dict

from app.schemas.model_status import ModelFileStatus, ModelStatusResponse


MODEL_DIR = Path("app/ml/models")
METADATA_PATH = MODEL_DIR / "model_metadata.json"
RISK_MODEL_PATH = MODEL_DIR / "risk_classifier.pkl"
REVENUE_MODEL_PATH = MODEL_DIR / "revenue_regressor.pkl"
FEASIBILITY_MODEL_PATH = MODEL_DIR / "feasibility_regressor.pkl"


def _load_metadata() -> Dict[str, Any]:
    if not METADATA_PATH.exists():
        return {}

    with METADATA_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_model_status() -> ModelStatusResponse:
    metadata = _load_metadata()
    metrics = metadata.get("metrics", {})
    risk_metrics = metrics.get("risk_classifier", {})
    revenue_metrics = metrics.get("revenue_regressor", {})
    feasibility_metrics = metrics.get("feasibility_regressor", {})

    file_status = ModelFileStatus(
        risk_classifier=RISK_MODEL_PATH.exists(),
        revenue_regressor=REVENUE_MODEL_PATH.exists(),
        feasibility_regressor=FEASIBILITY_MODEL_PATH.exists(),
        metadata=METADATA_PATH.exists(),
    )

    all_files_ready = all(
        [
            file_status.risk_classifier,
            file_status.revenue_regressor,
            file_status.feasibility_regressor,
            file_status.metadata,
        ]
    )

    return ModelStatusResponse(
        status="ready" if all_files_ready else "incomplete",
        trained_at=metadata.get("trained_at"),
        dataset_path=metadata.get("dataset_path"),
        row_count=int(metadata.get("row_count", 0) or 0),
        feature_count=int(metadata.get("feature_count", 0) or 0),
        categorical_feature_count=len(metadata.get("categorical_features", []) or []),
        numeric_feature_count=len(metadata.get("numeric_features", []) or []),
        targets=metadata.get("targets", {}) or {},
        risk_accuracy=risk_metrics.get("accuracy"),
        revenue_mae=revenue_metrics.get("mae"),
        revenue_rmse=revenue_metrics.get("rmse"),
        revenue_r2=revenue_metrics.get("r2"),
        feasibility_mae=feasibility_metrics.get("mae"),
        feasibility_rmse=feasibility_metrics.get("rmse"),
        feasibility_r2=feasibility_metrics.get("r2"),
        model_files=file_status,
        important_note=metadata.get(
            "important_note",
            "Models are trained on simulation-based labels and should be used as planning estimates, not guaranteed outcomes.",
        ),
    )
