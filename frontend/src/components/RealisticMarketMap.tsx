import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";

import type { GeospatialMarketContext } from "@/services/api";

type Props = {
  geoContext: GeospatialMarketContext;
  className?: string;
};

type MapPoint = {
  id: string;
  label: string;
  type: string;
  credibility?: string;
  latitude: number;
  longitude: number;
  source?: string;
  score?: number;
  address?: string;
  category?: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTransitMarker(type?: string): boolean {
  return (type || "").toLowerCase().includes("transit");
}

function isCompetitorMarker(type?: string): boolean {
  return (type || "").toLowerCase().includes("competitor");
}

function iconForMarker(marker: MapPoint) {
  if (isTransitMarker(marker.type)) {
    return createBusStopIcon(30);
  }

  return createPinIcon(markerColor(marker.type), isCompetitorMarker(marker.type) ? 30 : 32);
}

function getCenter(geoContext: GeospatialMarketContext): [number, number] {
  const lat = geoContext.center?.latitude;
  const lng = geoContext.center?.longitude;

  if (isFiniteNumber(lat) && isFiniteNumber(lng)) {
    return [lat, lng];
  }

  // Safe Ontario fallback only for rendering failure prevention.
  // The backend should normally provide dynamic geocoded coordinates.
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

function createPinIcon(color: string, size = 34) {
  return L.divIcon({
    className: "zonalyze-map-pin",
    html: `
      <div style="width:${size}px;height:${size}px;position:relative;">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,.45));">
          <path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.7" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function createBusStopIcon(size = 30) {
  return L.divIcon({
    className: "zonalyze-bus-stop-icon",
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:999px;
        background:#1a73e8;
        border:2px solid white;
        box-shadow:0 3px 8px rgba(0,0,0,.45);
      ">
        <svg width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="3" width="14" height="15" rx="3" fill="white"/>
          <path d="M7.5 7.5H16.5" stroke="#1a73e8" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M7.5 11H16.5" stroke="#1a73e8" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="8.5" cy="15" r="1.2" fill="#1a73e8"/>
          <circle cx="15.5" cy="15" r="1.2" fill="#1a73e8"/>
          <path d="M8 19.5H10" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M14 19.5H16" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitToRadius({ center, radiusKm }: { center: [number, number]; radiusKm: number }) {
  const map = useMap();

  useEffect(() => {
    const safeRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 5;
    const [lat, lng] = center;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const latPadding = safeRadiusKm / 111.32;
    const lngPadding = safeRadiusKm / (111.32 * Math.max(0.15, Math.cos((lat * Math.PI) / 180)));

    const bounds = L.latLngBounds(
      [lat - latPadding, lng - lngPadding],
      [lat + latPadding, lng + lngPadding],
    );

    const timeout = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, {
        padding: [34, 34],
        maxZoom: safeRadiusKm <= 2 ? 14 : safeRadiusKm <= 5 ? 13 : 12,
      });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [map, center[0], center[1], radiusKm]);

  return null;
}

function normalizeMarkers(geoContext: GeospatialMarketContext): MapPoint[] {
  const center = getCenter(geoContext);
  const radiusKm = Number.isFinite(geoContext.radius_km) ? geoContext.radius_km : 5;
  const markers = Array.isArray(geoContext.markers) ? geoContext.markers : [];

  return markers
    .map((marker: any, index: number): MapPoint | null => {
      const rawLat = marker.latitude ?? marker.lat ?? marker.coordinates?.latitude;
      const rawLng = marker.longitude ?? marker.lng ?? marker.coordinates?.longitude;

      let latitude = isFiniteNumber(rawLat) ? rawLat : null;
      let longitude = isFiniteNumber(rawLng) ? rawLng : null;

      // Backward compatibility with the old non-map panel markers.
      // If backend only returns x/y offsets, project them around the dynamic center.
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
        credibility: marker.credibility,
        latitude,
        longitude,
        source: marker.source ?? marker.source_name ?? marker.source_method,
        score: marker.score,
        address: marker.address,
        category: marker.category ?? marker.business_category ?? marker.subcategory,
      };
    })
    .filter(Boolean) as MapPoint[];
}

export default function RealisticMarketMap({ geoContext, className = "" }: Props) {
  const center = getCenter(geoContext);
  const radiusKm = Number.isFinite(geoContext.radius_km) && geoContext.radius_km > 0 ? geoContext.radius_km : 5;
  const markers = useMemo(() => normalizeMarkers(geoContext), [geoContext]);
  const mapKey = `${geoContext.municipality_name}-${geoContext.business_subcategory}-${radiusKm}-${center[0]}-${center[1]}`;

  return (
    <div className={`overflow-hidden rounded-lg border bg-slate-950 ${className}`}>
      <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,.8)]" />
            <h3 className="text-sm font-semibold tracking-wide text-white/90">
              Realistic Market Map
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
            {geoContext.map_credibility ?? "open map"}
          </span>
        </div>
      </div>

      <div className="h-[460px] w-full bg-slate-900">
        <MapContainer
          key={mapKey}
          center={center}
          zoom={13}
          scrollWheelZoom
          className="z-0 h-full w-full"
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <FitToRadius center={center} radiusKm={radiusKm} />

          <Circle
            center={center}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#d93025",
              weight: 2,
              opacity: 0.95,
              fillColor: "#d93025",
              fillOpacity: 0.13,
            }}
          />

          <Marker position={center} icon={createPinIcon("#d93025", 44)}>
            <Popup>
              <div style={{ minWidth: 210 }}>
                <strong>{geoContext.municipality_name}</strong>
                <br />
                {geoContext.business_subcategory}
                <br />
                Analysis radius: {radiusKm} km
                <br />
                Center: {center[0].toFixed(4)}, {center[1].toFixed(4)}
              </div>
            </Popup>
          </Marker>

          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.latitude, marker.longitude]}
              icon={iconForMarker(marker)}
            >
              <Popup>
                <div style={{ minWidth: 220, lineHeight: 1.5 }}>
                  <strong>{marker.label}</strong>

                  {isCompetitorMarker(marker.type) ? (
                    <>
                      <br />
                      {marker.address ? marker.address : "Address not available"}
                    </>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

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
          <p className="mt-1 text-white/70">OpenStreetMap/CARTO tiles, free for demo use.</p>
        </div>
      </div>
    </div>
  );
}
