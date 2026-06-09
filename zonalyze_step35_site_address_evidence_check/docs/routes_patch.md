# Backend route patch

If you do not replace `backend/app/api/routes.py`, add these imports:

```python
from app.schemas.site_address import SiteAddressAnalysisRequest, SiteAddressAnalysisResponse
from app.services.site_address_service import analyze_site_address
```

Then add this route near the other `/geo/...` routes:

```python
@router.post("/geo/site-address-analysis", response_model=SiteAddressAnalysisResponse)
def site_address_analysis_route(request: SiteAddressAnalysisRequest):
    return analyze_site_address(request)
```
