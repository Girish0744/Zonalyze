from pathlib import Path
from typing import List, Dict

import pandas as pd


CITY_FEATURES_PATH = Path("app/data/processed/ontario_csd_selected_features_2021.csv")
BUSINESS_TAXONOMY_PATH = Path("app/data/synthetic/zonalyze_business_taxonomy_seed.csv")


def get_municipalities() -> List[Dict[str, str]]:
    df = pd.read_csv(CITY_FEATURES_PATH)

    municipalities = (
        df[["municipality_name", "municipality_type"]]
        .dropna(subset=["municipality_name"])
        .drop_duplicates()
        .sort_values("municipality_name")
    )

    return [
        {
            "municipality_name": row["municipality_name"],
            "municipality_type": row["municipality_type"],
            "label": f"{row['municipality_name']} ({row['municipality_type']})",
        }
        for _, row in municipalities.iterrows()
    ]


def get_business_subcategories() -> List[Dict[str, str]]:
    df = pd.read_csv(BUSINESS_TAXONOMY_PATH)

    businesses = (
        df[["category", "subcategory"]]
        .dropna(subset=["subcategory"])
        .drop_duplicates()
        .sort_values(["category", "subcategory"])
    )

    return [
        {
            "business_category": row["category"],
            "business_subcategory": row["subcategory"],
            "label": f"{row['subcategory']} — {row['category']}",
        }
        for _, row in businesses.iterrows()
    ]