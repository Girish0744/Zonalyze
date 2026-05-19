// import React from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { 
//   Globe, Radio, Layers, Map, 
//   Box, MousePointer2, Settings2, Share2, Activity
// } from 'lucide-react';

// export default function Geospatial() {
//   return (
//     <div className="min-h-screen bg-background text-foreground p-6 font-sans">
//       <header className="mb-8 border-b border-white/10 pb-4 flex justify-between items-center">
//         <div>
//           <h1 className="text-3xl font-display font-bold tracking-wider text-white">SPATIAL <span className="text-primary">MAPPING</span></h1>
//           <p className="text-muted-foreground text-xs lcd-text">Geographic Intelligence System (GIS)</p>
//         </div>
//         <div className="flex gap-2">
//            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">GPS: ACTIVE</Badge>
//            <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20">SAT: LINKED</Badge>
//         </div>
//       </header>

//       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//         <div className="lg:col-span-1 space-y-4">
//           <Card className="scada-panel">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-xs lcd-text text-white/70 uppercase">Layer Selection</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-2">
//               {[
//                 { id: 'pop', label: 'Population Heat', icon: Globe, active: true },
//                 { id: 'comp', label: 'Competitor Nodes', icon: Radio, active: true },
//                 { id: 'traf', label: 'Traffic Density', icon: Activity, active: false },
//                 { id: 'util', label: 'Infrastructure', icon: Layers, active: false },
//               ].map(layer => (
//                 <button 
//                   key={layer.id}
//                   className={`w-full flex items-center justify-between p-3 rounded border transition-all ${layer.active ? 'bg-primary/10 border-primary/30 text-white' : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'}`}
//                 >
//                   <div className="flex items-center gap-3">
//                     <layer.icon className="w-4 h-4" />
//                     <span className="text-sm font-mono">{layer.label}</span>
//                   </div>
//                   {layer.active && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
//                 </button>
//               ))}
//             </CardContent>
//           </Card>

//           <Card className="scada-panel">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-xs lcd-text text-white/70 uppercase">Viewport Controls</CardTitle>
//             </CardHeader>
//             <CardContent className="grid grid-cols-2 gap-2">
//                <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">Zoom In</button>
//                <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">Zoom Out</button>
//                <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">Center</button>
//                <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">3D Mode</button>
//             </CardContent>
//           </Card>
//         </div>

//         <div className="lg:col-span-3">
//            <Card className="scada-panel h-[600px] flex items-center justify-center relative bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center grayscale opacity-40 brightness-50">
//              <div className="absolute inset-0 bg-primary/10 mix-blend-overlay"></div>
//              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-black/60 backdrop-blur-sm">
//                 <div className="relative mb-6">
//                   <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
//                   <Globe className="w-16 h-16 text-primary relative z-10" />
//                 </div>
//                 <h2 className="text-2xl font-display font-bold text-white mb-2">SPATIAL RENDERER</h2>
//                 <p className="text-muted-foreground lcd-text text-sm mb-6 max-w-md">Initializing high-fidelity geographic simulation. This environment uses real-time vector tiles and demographic overlays.</p>
//                 <div className="flex gap-4">
//                   <Button className="font-mono h-10 px-6 uppercase tracking-widest bg-primary hover:bg-primary/80">Launch Viewer</Button>
//                   <Button variant="outline" className="font-mono h-10 px-6 uppercase tracking-widest border-white/20">Calibrate Sensors</Button>
//                 </div>
//              </div>
//              {/* Decorative HUD elements */}
//              <div className="absolute top-4 right-4 p-2 bg-black/80 border border-white/10 rounded font-mono text-[10px] text-primary space-y-1">
//                 <p>LAT: 40.7128° N</p>
//                 <p>LNG: 74.0060° W</p>
//                 <p>ALT: 2,402m</p>
//              </div>
//            </Card>
//         </div>
//       </div>
//     </div>
//   );
// }



// frontend/src/pages/geospatial.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe, Radio, Layers, Activity, Cpu
} from 'lucide-react';
import {
  analyzeScenario,
  fetchRegisteredSensors,
  checkHealth,
  checkDatabase,
  AVAILABLE_ZONES,
  BUSINESS_TYPE_MAP,
  getIndicatorColor,
  getIndicatorBg,
  type DashboardSummaryResponse,
} from "@/services/api";

const ZONE_COORDS: Record<string, { lat: string; lng: string }> = {
  "Waterloo Region": { lat: "43.4643° N", lng: "80.5204° W" },
  "Kitchener Downtown": { lat: "43.4516° N", lng: "80.4925° W" },
  "Cambridge": { lat: "43.3616° N", lng: "80.3144° W" },
};

export default function Geospatial() {
  const [sensors, setSensors] = useState<Record<string, string>>({});
  const [zoneData, setZoneData] = useState<Record<string, DashboardSummaryResponse | null>>({});
  const [health, setHealth] = useState<{ api: boolean; db: boolean; dbMsg: string }>({ api: false, db: false, dbMsg: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        // Fetch registered sensors
        const sensorRes = await fetchRegisteredSensors().catch(() => ({ sensors: {} }));
        setSensors(sensorRes.sensors);

        // Fetch health + DB status
        const [healthRes, dbRes] = await Promise.all([
          checkHealth().catch(() => ({ status: "error", service: "unknown" })),
          checkDatabase().catch(() => ({ database_connected: false, message: "unreachable" })),
        ]);
        setHealth({
          api: healthRes.status === "ok",
          db: dbRes.database_connected,
          dbMsg: dbRes.message,
        });

        // Fetch data for all 3 zones
        const results: Record<string, DashboardSummaryResponse | null> = {};
        for (const zone of AVAILABLE_ZONES) {
          try {
            results[zone] = await analyzeScenario({
              selected_zone: zone,
              selected_business_type: "Coffee Shop",
              radius_km: 5,
            });
          } catch {
            results[zone] = null;
          }
        }
        setZoneData(results);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-white">SPATIAL <span className="text-primary">MAPPING</span></h1>
          <p className="text-muted-foreground text-xs lcd-text">Geographic Intelligence System (GIS) — All Zones Overview</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className={`${health.api ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-destructive/5 text-destructive border-destructive/20'}`}>
            API: {health.api ? 'ONLINE' : 'OFFLINE'}
          </Badge>
          <Badge variant="outline" className={`${health.db ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-destructive/5 text-destructive border-destructive/20'}`}>
            DB: {health.db ? 'CONNECTED' : 'DOWN'}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="scada-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lcd-text text-white/70 uppercase">Registered Sensors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(sensors).length === 0 && (
                <p className="text-muted-foreground text-xs lcd-text py-4 text-center">No sensors registered</p>
              )}
              {Object.entries(sensors).map(([type, device]) => (
                <div
                  key={type}
                  className="w-full flex items-center justify-between p-3 rounded border transition-all bg-primary/10 border-primary/30 text-white"
                >
                  <div className="flex items-center gap-3">
                    <Radio className="w-4 h-4 text-primary" />
                    <div>
                      <span className="text-sm font-mono block">{type}</span>
                      <span className="text-[10px] text-muted-foreground">{device}</span>
                    </div>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="scada-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lcd-text text-white/70 uppercase">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-white/5 rounded text-xs font-mono">
                <span className="text-muted-foreground">Backend API</span>
                <span className={health.api ? 'text-emerald-400' : 'text-destructive'}>{health.api ? 'OK' : 'ERROR'}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded text-xs font-mono">
                <span className="text-muted-foreground">PostgreSQL</span>
                <span className={health.db ? 'text-emerald-400' : 'text-destructive'}>{health.db ? 'OK' : 'DOWN'}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded text-xs font-mono">
                <span className="text-muted-foreground">Sensors</span>
                <span className="text-primary">{Object.keys(sensors).length} active</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{health.dbMsg}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main area: Zone comparison grid */}
        <div className="lg:col-span-3">
          <h2 className="text-lg font-display text-white/90 mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Zone Comparison ({loading ? 'Loading...' : `${AVAILABLE_ZONES.length} zones`})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {AVAILABLE_ZONES.map(zone => {
              const zd = zoneData[zone];
              const pkt = zd?.people_location_packet;
              const pop = pkt?.metrics.find(m => m.key === "population_total")?.value ?? 0;
              const students = pkt?.metrics.find(m => m.key === "students_pct")?.value ?? 0;
              const families = pkt?.metrics.find(m => m.key === "families_pct")?.value ?? 0;
              const retirees = pkt?.metrics.find(m => m.key === "retirees_pct")?.value ?? 0;
              const coords = ZONE_COORDS[zone];

              return (
                <Card key={zone} className={`scada-panel border ${pkt ? getIndicatorBg(pkt.indicator) : 'border-white/5'}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className={`w-4 h-4 ${pkt ? getIndicatorColor(pkt.indicator) : 'text-muted-foreground'}`} />
                        <span className="text-white">{zone}</span>
                      </div>
                      {pkt && (
                        <Badge variant="outline" className={`text-[10px] uppercase ${getIndicatorColor(pkt.indicator)} border-current`}>
                          {pkt.indicator}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pkt ? (
                      <>
                        <p className="text-[10px] text-muted-foreground lcd-text">{pkt.summary_text}</p>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="bg-white/5 rounded p-2">
                            <p className="text-[10px] text-muted-foreground">Population</p>
                            <p className="text-lg font-mono text-primary">{pop.toLocaleString()}</p>
                          </div>
                          <div className="bg-white/5 rounded p-2">
                            <p className="text-[10px] text-muted-foreground">Students</p>
                            <p className="text-lg font-mono text-accent">{students}%</p>
                          </div>
                          <div className="bg-white/5 rounded p-2">
                            <p className="text-[10px] text-muted-foreground">Families</p>
                            <p className="text-lg font-mono text-white">{families}%</p>
                          </div>
                          <div className="bg-white/5 rounded p-2">
                            <p className="text-[10px] text-muted-foreground">Retirees</p>
                            <p className="text-lg font-mono text-white">{retirees}%</p>
                          </div>
                        </div>

                        {coords && (
                          <div className="text-[10px] font-mono text-muted-foreground mt-2 p-2 bg-black/30 rounded border border-white/5">
                            <p>LAT: {coords.lat}</p>
                            <p>LNG: {coords.lng}</p>
                          </div>
                        )}

                        {/* Competition & Revenue Monitors */}
                        {zd?.competition_monitor && (
                          <div className={`text-[10px] font-mono p-2 rounded border mt-1 ${getIndicatorBg(zd.competition_monitor.indicator)}`}>
                            <span className="text-muted-foreground">Competition: </span>
                            <span className="text-white/80">{zd.competition_monitor.value}</span>
                          </div>
                        )}
                        {zd?.revenue_monitor && (
                          <div className={`text-[10px] font-mono p-2 rounded border ${getIndicatorBg(zd.revenue_monitor.indicator)}`}>
                            <span className="text-muted-foreground">Revenue: </span>
                            <span className="text-white/80">{zd.revenue_monitor.value}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-8 text-center">
                        <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
                        <p className="text-[10px] text-muted-foreground lcd-text uppercase">{loading ? 'Fetching data...' : 'No data available'}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
