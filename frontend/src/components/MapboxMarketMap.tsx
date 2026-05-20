import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import RealisticMarketMap from "@/components/RealisticMarketMap";
import type { GeospatialMarketContext } from "@/services/api";

type Props = {
  geoContext: GeospatialMarketContext;
  className?: string;
};

type NormalizedMarker = {
  id: string;
  label: string;
  type: string;
  latitude: number;
  longitude: number;
  credibility?: string;
  source?: string;
  address?: string | null;
  category?: string | null;
  intensity?: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getCenter(geoContext: GeospatialMarketContext): [number, number] {
  const lat = geoContext.center?.latitude;
  const lng = geoContext.center?.longitude;

  if (isFiniteNumber(lat) && isFiniteNumber(lng)) {
    return [lat, lng];
  }

  // Safe Ontario fallback only for rendering failure prevention.
  return [43.4516, -80.4925];
}

function markerColor(type?: string): string {
  const normalized = (type || "").toLowerCase();

  if (normalized.includes("competitor")) return "#d93025";
  if (normalized.includes("transit")) return "#1a73e8";
  if (normalized.includes("lease")) return "#f9ab00";
  if (normalized.includes("demand")) return "#188038";
  if (normalized.includes("commercial")) return "#9334e6";

  return "#d93025";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeMarkers(geoContext: GeospatialMarketContext): NormalizedMarker[] {
  const center = getCenter(geoContext);
  const radiusKm = Number.isFinite(geoContext.radius_km) ? geoContext.radius_km : 5;
  const markers = Array.isArray(geoContext.markers) ? geoContext.markers : [];

  return markers
    .map((marker: any, index: number): NormalizedMarker | null => {
      const rawLat = marker.latitude ?? marker.lat ?? marker.coordinates?.latitude;
      const rawLng = marker.longitude ?? marker.lng ?? marker.coordinates?.longitude;

      let latitude = isFiniteNumber(rawLat) ? rawLat : null;
      let longitude = isFiniteNumber(rawLng) ? rawLng : null;

      // Backward compatibility with the old x/y offset markers.
      if (latitude === null || longitude === null) {
        const xOffsetPct = Number(marker.x_offset_pct ?? 0);
        const yOffsetPct = Number(marker.y_offset_pct ?? 0);
        const kmEast = (Number.isFinite(xOffsetPct) ? xOffsetPct : 0) / 100 * radiusKm;
        const kmNorth = (Number.isFinite(yOffsetPct) ? yOffsetPct : 0) / 100 * radiusKm;

        latitude = center[0] + kmNorth / 111.32;
        longitude = center[1] + kmEast / (111.32 * Math.max(0.15, Math.cos((center[0] * Math.PI) / 180)));
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

      return {
        id: String(marker.marker_id ?? marker.id ?? `marker-${index}`),
        label: String(marker.label ?? marker.title ?? marker.name ?? "Market evidence"),
        type: String(marker.marker_type ?? marker.type ?? "evidence"),
        latitude,
        longitude,
        credibility: marker.credibility,
        source: marker.source ?? marker.source_name ?? marker.source_method,
        address: marker.address,
        category: marker.category ?? marker.business_category ?? marker.subcategory,
        intensity: marker.intensity,
      };
    })
    .filter(Boolean) as NormalizedMarker[];
}

function createMarkerElement(color: string, size = 34): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "zonalyze-mapbox-marker";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.cursor = "pointer";
  el.style.filter = "drop-shadow(0 3px 7px rgba(0,0,0,.45))";
  el.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.7" fill="white"/>
    </svg>
  `;
  return el;
}

function createBusStopElement(size = 30): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "zonalyze-mapbox-bus-marker";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.borderRadius = "999px";
  el.style.background = "#1a73e8";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 3px 8px rgba(0,0,0,.45)";
  el.style.cursor = "pointer";
  el.innerHTML = `
    <svg width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="3" width="14" height="15" rx="3" fill="white"/>
      <path d="M7.5 7.5H16.5" stroke="#1a73e8" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M7.5 11H16.5" stroke="#1a73e8" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="8.5" cy="15" r="1.2" fill="#1a73e8"/>
      <circle cx="15.5" cy="15" r="1.2" fill="#1a73e8"/>
    </svg>
  `;
  return el;
}

function circlePolygon(center: [number, number], radiusKm: number, points = 96) {
  const [lat, lng] = center;
  const coordinates: number[][] = [];
  const safeRadius = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 5;

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const dx = Math.cos(angle) * safeRadius;
    const dy = Math.sin(angle) * safeRadius;
    const pointLat = lat + dy / 111.32;
    const pointLng = lng + dx / (111.32 * Math.max(0.15, Math.cos((lat * Math.PI) / 180)));
    coordinates.push([pointLng, pointLat]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      },
    ],
  } as any;
}

function heatmapGeoJson(geoContext: GeospatialMarketContext) {
  const cells = Array.isArray(geoContext.heatmap_cells) ? geoContext.heatmap_cells : [];
  return {
    type: "FeatureCollection",
    features: cells
      .filter((cell: any) => isFiniteNumber(cell.latitude) && isFiniteNumber(cell.longitude))
      .map((cell: any, index: number) => ({
        type: "Feature",
        properties: {
          id: cell.cell_id ?? `heat-${index}`,
          label: cell.label ?? "Demand/risk cell",
          demand: Number(cell.demand_intensity ?? 50),
          risk: Number(cell.risk_intensity ?? 50),
        },
        geometry: {
          type: "Point",
          coordinates: [cell.longitude, cell.latitude],
        },
      })),
  } as any;
}

function isTransitMarker(type?: string): boolean {
  return (type || "").toLowerCase().includes("transit");
}

function isCompetitorMarker(type?: string): boolean {
  return (type || "").toLowerCase().includes("competitor");
}

function fitMapToRadius(map: mapboxgl.Map, center: [number, number], radiusKm: number) {
  const [lat, lng] = center;
  const safeRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 5;
  const latPadding = safeRadiusKm / 111.32;
  const lngPadding = safeRadiusKm / (111.32 * Math.max(0.15, Math.cos((lat * Math.PI) / 180)));

  map.fitBounds(
    [
      [lng - lngPadding, lat - latPadding],
      [lng + lngPadding, lat + latPadding],
    ],
    {
      padding: 42,
      maxZoom: safeRadiusKm <= 2 ? 14 : safeRadiusKm <= 5 ? 13 : 12,
      duration: 700,
    },
  );
}

function popupHtmlForMarker(marker: NormalizedMarker): string {
  return `
    <div style="min-width:220px;max-width:270px;font-family:Inter,Arial,sans-serif;line-height:1.45;">
      <div style="font-weight:700;font-size:13px;color:#111827;">${escapeHtml(marker.label)}</div>
      <div style="margin-top:4px;font-size:12px;color:#374151;">Type: ${escapeHtml(marker.type)}</div>
      ${marker.address ? `<div style="margin-top:4px;font-size:12px;color:#374151;">${escapeHtml(marker.address)}</div>` : ""}
      ${marker.source ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;">Source: ${escapeHtml(marker.source)}</div>` : ""}
      ${marker.credibility ? `<div style="margin-top:4px;font-size:11px;color:#6b7280;">Credibility: ${escapeHtml(marker.credibility)}</div>` : ""}
    </div>
  `;
}

export default function MapboxMarketMap({ geoContext, className = "" }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);

  const center = getCenter(geoContext);
  const radiusKm = Number.isFinite(geoContext.radius_km) && geoContext.radius_km > 0 ? geoContext.radius_km : 5;
  const markers = useMemo(() => normalizeMarkers(geoContext), [geoContext]);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN?.trim();

  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center[1], center[0]],
      zoom: 12,
      pitch: 0,
      bearing: 0,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      map.addSource("analysis-radius", {
        type: "geojson",
        data: circlePolygon(center, radiusKm),
      });

      map.addLayer({
        id: "analysis-radius-fill",
        type: "fill",
        source: "analysis-radius",
        paint: {
          "fill-color": "#d93025",
          "fill-opacity": 0.14,
        },
      });

      map.addLayer({
        id: "analysis-radius-line",
        type: "line",
        source: "analysis-radius",
        paint: {
          "line-color": "#d93025",
          "line-opacity": 0.95,
          "line-width": 2.5,
        },
      });

      map.addSource("heatmap-cells", {
        type: "geojson",
        data: heatmapGeoJson(geoContext),
      });

      map.addLayer({
        id: "heatmap-cells-layer",
        type: "circle",
        source: "heatmap-cells",
        paint: {
          "circle-radius": 18,
          "circle-color": [
            "case",
            [">", ["get", "risk"], 70],
            "#d93025",
            [">", ["get", "demand"], 65],
            "#188038",
            "#f9ab00",
          ],
          "circle-opacity": 0.22,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.35,
        },
      });

      fitMapToRadius(map, center, radiusKm);
    });

    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Create the map once. Scenario updates are handled in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapboxToken) return;

    const updateMap = () => {
      map.resize();
      map.setCenter([center[1], center[0]]);

      const radiusSource = map.getSource("analysis-radius") as mapboxgl.GeoJSONSource | undefined;
      if (radiusSource) {
        radiusSource.setData(circlePolygon(center, radiusKm));
      }

      const heatmapSource = map.getSource("heatmap-cells") as mapboxgl.GeoJSONSource | undefined;
      if (heatmapSource) {
        heatmapSource.setData(heatmapGeoJson(geoContext));
      }

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];

      const centerMarker = new mapboxgl.Marker({
        element: createMarkerElement("#d93025", 44),
        anchor: "bottom",
      })
        .setLngLat([center[1], center[0]])
        .setPopup(
          new mapboxgl.Popup({ offset: 28 }).setHTML(`
            <div style="min-width:210px;font-family:Inter,Arial,sans-serif;line-height:1.45;">
              <div style="font-weight:700;font-size:13px;color:#111827;">${escapeHtml(geoContext.municipality_name)}</div>
              <div style="margin-top:4px;font-size:12px;color:#374151;">${escapeHtml(geoContext.business_subcategory)}</div>
              <div style="margin-top:4px;font-size:12px;color:#374151;">Analysis radius: ${radiusKm} km</div>
              <div style="margin-top:4px;font-size:11px;color:#6b7280;">Center: ${center[0].toFixed(4)}, ${center[1].toFixed(4)}</div>
            </div>
          `),
        )
        .addTo(map);

      markerRefs.current.push(centerMarker);

      markers.forEach((marker) => {
        const element = isTransitMarker(marker.type)
          ? createBusStopElement(30)
          : createMarkerElement(markerColor(marker.type), isCompetitorMarker(marker.type) ? 30 : 32);

        const mapMarker = new mapboxgl.Marker({
          element,
          anchor: isTransitMarker(marker.type) ? "center" : "bottom",
        })
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(popupHtmlForMarker(marker)))
          .addTo(map);

        markerRefs.current.push(mapMarker);
      });

      fitMapToRadius(map, center, radiusKm);
    };

    if (map.isStyleLoaded()) {
      updateMap();
    } else {
      map.once("load", updateMap);
    }
  }, [mapboxToken, center[0], center[1], radiusKm, geoContext, markers]);

  // Keep the current free Leaflet map as a safe fallback if the team has not configured Mapbox yet.
  if (!mapboxToken) {
    return <RealisticMarketMap geoContext={geoContext} className={className} />;
  }

  return (
    <div className={`overflow-hidden rounded-lg border bg-slate-950 ${className}`}>
      <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,.8)]" />
            <h3 className="text-sm font-semibold tracking-wide text-white/90">
              Mapbox Market Map
            </h3>
          </div>
          <p className="mt-1 text-[11px] font-mono text-white/50">
            {geoContext.municipality_name} · {geoContext.business_subcategory} · {radiusKm} km radius
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-red-400/30 px-2.5 py-1 text-[10px] font-mono uppercase text-red-300">
            selected area
          </span>
          <span className="rounded-full border border-primary/30 px-2.5 py-1 text-[10px] font-mono uppercase text-primary">
            mapbox streets
          </span>
        </div>
      </div>

      <div ref={mapContainerRef} className="h-[460px] w-full bg-slate-900" />

      <div className="grid gap-3 border-t border-white/10 px-5 py-4 text-[11px] text-white/55 md:grid-cols-3">
        <div>
          <p className="font-mono uppercase tracking-widest text-white/35">Coverage</p>
          <p className="mt-1 text-white/70">{geoContext.radius_label ?? `${radiusKm} km analysis radius`}</p>
        </div>
        <div>
          <p className="font-mono uppercase tracking-widest text-white/35">Evidence</p>
          <p className="mt-1 text-white/70">{markers.length} map evidence marker(s)</p>
        </div>
        <div>
          <p className="font-mono uppercase tracking-widest text-white/35">Map source</p>
          <p className="mt-1 text-white/70">Mapbox GL JS. Uses your free-tier public token.</p>
        </div>
      </div>
    </div>
  );
}
