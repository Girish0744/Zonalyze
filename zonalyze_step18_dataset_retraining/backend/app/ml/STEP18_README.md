# Step 18 - Dataset Realism and Model Retraining

Run these commands from the `backend` folder.

## 1. Install missing dependencies

```bash
pip install pandas numpy scikit-learn joblib
```

## 2. Generate improved training dataset

```bash
python -m app.ml.generate_training_dataset --rows 50000
```

This creates:

```txt
app/data/generated/zonalyze_training_dataset_v2.csv
app/data/generated/zonalyze_training_dataset_v2.summary.json
```

## 3. Train new models

```bash
python -m app.ml.train_models --rows 50000 --force-regenerate
```

This creates:

```txt
app/ml/models/risk_classifier.pkl
app/ml/models/revenue_regressor.pkl
app/ml/models/feasibility_regressor.pkl
app/ml/models/model_metadata.json
app/ml/models/feature_columns.json
```

## 4. Restart backend

```bash
uvicorn app.main:app --reload
```

## 5. Test

```txt
http://127.0.0.1:8000/ml/model-status
http://127.0.0.1:8000/dashboard-summary
```

## Important note

The generated labels are still simulation-generated prototype labels. Step 18 improves business-specific realism and uses the shared business subcategory catalog, but the model should still be described as a prototype predictive layer until real outcome data is available.
