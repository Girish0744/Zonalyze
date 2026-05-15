import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GeospatialMarketContext } from "@/services/api";

type AnyMarker = Record<string, any>;

type MapPoint = {
  id: string;
  title: string;
  type: string;
  credibility?: string;
  lat: number;
  lng: number;
  color: string;
  source?: string;
};

function markerColor(markerType?: string) {
  const type = String(markerType || "").toLowerCase();

  if (type.includes("competitor")) return "#d93025";
  if (type.includes("demand")) return "#188038";
  if (type.includes("lease")) return "#f9ab00";
  if (type.includes("transit")) return "#1a73e8";
  if (type.includes("commercial")) return "#9334e6";

  return "#d93025";
}

function createPinIcon(color: string, size = 34) {
  return L.divIcon({
    className: "zonalyze-map-pin",
    html: `
      <div style="width:${size}px;height:${size}px;transform:translate(-50%,-100%);position:relative;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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

function getCenter(geoContext: GeospatialMarketContext | null) {
  const center: any = geoContext?.center ?? {};

  const latitude =
    center.latitude ??
    center.lat ??
    (geoContext as any)?.center_latitude ??
    (geoContext as any)?.latitude;

  const longitude =
    center.longitude ??
    center.lng ??
    (geoContext as any)?.center_longitude ??
    (geoContext as any)?.longitude;

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
}

function markerCoordinateFromOffset(
  marker: AnyMarker,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
) {
  const explicitLat = marker.latitude ?? marker.lat;
  const explicitLng = marker.longitude ?? marker.lng;

  if (
    typeof explicitLat === "number" &&
    Number.isFinite(explicitLat) &&
    typeof explicitLng === "number" &&
    Number.isFinite(explicitLng)
  ) {
    return { lat: explicitLat, lng: explicitLng };
  }

  const xOffsetPct = Number(marker.x_offset_pct ?? 0);
  const yOffsetPct = Number(marker.y_offset_pct ?? 0);

  const kmEast = (xOffsetPct / 100) * radiusKm;
  const kmNorth = (yOffsetPct / 100) * radiusKm;

  const latDelta = kmNorth / 111.32;
  const lngDelta = kmEast / (111.32 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2));

  return {
    lat: centerLat + latDelta,
    lng: centerLng + lngDelta,
  };
}

function normalizeMarkers(geoContext: GeospatialMarketContext | null): MapPoint[] {
  if (!geoContext) return [];

  const { latitude, longitude } = getCenter(geoContext);
  const radiusKm = Number((geoContext as any).radius_km ?? 5);
  const markers = ((geoContext as any).markers ?? []) as AnyMarker[];

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  return markers
    .map((marker, index) => {
      const coordinate = markerCoordinateFromOffset(marker, latitude, longitude, radiusKm);
      const type = String(marker.marker_type ?? marker.type ?? "market_evidence");

      if (!Number.isFinite(coordinate.lat) || !Number.isFinite(coordinate.lng)) return null;

      return {
        id: String(marker.marker_id ?? marker.id ?? `marker-${index}`),
        title: String(marker.label ?? marker.title ?? "Market evidence"),
        type,
        credibility: marker.credibility,
        lat: coordinate.lat,
        lng: coordinate.lng,
        color: markerColor(type),
        source: marker.source_method ?? marker.source_name ?? marker.source,
      };
    })
    .filter(Boolean) as MapPoint[];
}

function FitToRadius({ center, radiusKm }: { center: [number, number]; radiusKm: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const safeRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 5;
    const [lat, lng] = center;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const latPadding = safeRadiusKm / 111.32;
    const lngPadding = safeRadiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));

    const bounds = L.latLngBounds(
      [lat - latPadding, lng - lngPadding],
      [lat + latPadding, lng + lngPadding],
    );

    const timeout = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: safeRadiusKm <= 2 ? 14 : safeRadiusKm <= 5 ? 13 : 12,
      });
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [map, center[0], center[1], radiusKm]);

  return null;
}

function LoadingMapCard() {
  return (
    <Card className="scada-panel border-white/5">
      <CardContent className="p-5">
        <p className="text-xs lcd-text text-muted-foreground">
          Geospatial market context is loading...
        </p>
      </CardContent>
    </Card>
  );
}

export default function RealisticMarketMap({
  geoContext,
}: {
  geoContext: GeospatialMarketContext | null;
}) {
  const center = getCenter(geoContext);
  const radiusKm = Number((geoContext as any)?.radius_km ?? 5);
  const municipalityName = String((geoContext as any)?.municipality_name ?? "Selected municipality");
  const radiusLabel = String((geoContext as any)?.radius_label ?? `${radiusKm} km analysis radius`);

  const normalizedMarkers = useMemo(() => normalizeMarkers(geoContext), [geoContext]);

  if (!geoContext) return <LoadingMapCard />;

  if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) {
    return (
      <Card className="scada-panel border-white/5">
        <CardContent className="p-5">
          <p className="text-xs lcd-text text-destructive">
            Map coordinates are unavailable for {municipalityName}. The backend geospatial service did not return valid latitude/longitude.
          </p>
        </CardContent>
      </Card>
    );
  }

  const mapCenter: [number, number] = [center.latitude, center.longitude];

  return (
    <Card className="scada-panel border-white/5 overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm lcd-text text-white/80 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" /> Realistic Market Map
          </span>
          <Badge variant="outline" className="text-primary border-primary/30 uppercase">
            {(geoContext as any).map_credibility ?? "OPEN MAP"}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-2 grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 overflow-hidden rounded-lg border border-primary/20 bg-slate-950 h-[430px]">
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom
            className="h-full w-full z-0"
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            <FitToRadius center={mapCenter} radiusKm={radiusKm} />

            <Circle
              center={mapCenter}
              radius={radiusKm * 1000}
              pathOptions={{
                color: "#d93025",
                weight: 2,
                opacity: 0.95,
                fillColor: "#d93025",
                fillOpacity: 0.12,
              }}
            />

            <Marker position={mapCenter} icon={createPinIcon("#d93025", 42)}>
              <Popup>
                <div style={{ minWidth: 190 }}>
                  <strong>{municipalityName}</strong>
                  <br />
                  {radiusLabel}
                  <br />
                  Center: {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
                </div>
              </Popup>
            </Marker>

            {normalizedMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={createPinIcon(marker.color, marker.type.includes("competitor") ? 30 : 34)}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <strong>{marker.title}</strong>
                    <br />
                    Type: {marker.type.replace(/_/g, " ")}
                    {marker.credibility ? (
                      <>
                        <br />
                        Credibility: {marker.credibility}
                      </>
                    ) : null}
                    {marker.source ? (
                      <>
                        <br />
                        Source: {marker.source}
                      </>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="xl:col-span-2 space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Coverage</p>
            <p className="text-sm font-mono text-white">{radiusLabel}</p>
            <p className="text-[10px] text-white/50 mt-1">
              Center: {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-white/10 bg-white/[0.03] p-2">
              <p className="text-[9px] text-muted-foreground uppercase">Demand</p>
              <p className="text-xs font-mono text-emerald-400">
                {Number((geoContext as any).demand_pressure_index ?? 0).toFixed(1)}
              </p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] p-2">
              <p className="text-[9px] text-muted-foreground uppercase">Comp.</p>
              <p className="text-xs font-mono text-destructive">
                {Number((geoContext as any).competition_pressure_index ?? 0).toFixed(1)}
              </p>
            </div>
            <div className="rounded border border-white/10 bg-white/[0.03] p-2">
              <p className="text-[9px] text-muted-foreground uppercase">Lease</p>
              <p className="text-xs font-mono text-accent">
                {Number((geoContext as any).rent_pressure_index ?? 0).toFixed(1)}
              </p>
            </div>
          </div>

          <div className="rounded border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <p className="text-[10px] text-primary uppercase tracking-widest">Map Legend</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-destructive border-destructive/30">Competitors</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Demand</Badge>
              <Badge variant="outline" className="text-accent border-accent/30">Lease</Badge>
              <Badge variant="outline" className="text-primary border-primary/30">Transit / Area</Badge>
            </div>
          </div>

          <p className="text-[10px] text-white/55 leading-relaxed">
            {(geoContext as any).coverage_note ??
              "The red marker identifies the selected location and the red circle highlights the selected analysis radius."}
          </p>
          <p className="text-[10px] text-white/45 leading-relaxed">
            {(geoContext as any).evidence_note ??
              "Map tiles and street labels come from OpenStreetMap/CARTO. Market markers come from the backend geospatial evidence layer."}
          </p>

          <div className="rounded border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] text-primary uppercase tracking-widest mb-2">
              Next geospatial data needed
            </p>
            <ul className="space-y-1">
              {((geoContext as any).next_data_needed ?? [])
                .slice(0, 3)
                .map((item: string) => (
                  <li key={item} className="text-[10px] text-white/55 leading-relaxed">
                    • {item}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
