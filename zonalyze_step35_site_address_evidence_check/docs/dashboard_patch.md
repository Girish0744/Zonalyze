# Dashboard patch for Step 35: Site Address Evidence Check

Add this import near the other component imports in `frontend/src/pages/dashboard.tsx`:

```tsx
import SiteAddressAnalysisPanel from "@/components/SiteAddressAnalysisPanel";
```

Then add this panel in the left controls column, preferably after `LocationComparisonPanel` or near the map controls:

```tsx
<SiteAddressAnalysisPanel
  municipalityName={municipalityName}
  businessSubcategory={businessSubcategory}
  businessQuery={customBusinessQuery}
  radiusKm={Array.isArray(radius) ? radius[0] : Number(radius)}
/>
```

If your dashboard uses a different custom business state name, pass that state instead of `customBusinessQuery`. If you do not want to connect custom business text yet, pass `businessQuery={null}`.
