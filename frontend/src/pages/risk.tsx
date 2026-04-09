// import React from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { 
//   ShieldAlert, Crosshair, Zap, Activity, 
//   AlertTriangle, ShieldCheck, Search, Info
// } from 'lucide-react';

// export default function Risk() {
//   return (
//     <div className="min-h-screen bg-background text-foreground p-6 font-sans">
//       <header className="mb-8 border-b border-white/10 pb-4 flex justify-between items-end">
//         <div>
//           <h1 className="text-3xl font-display font-bold tracking-wider text-white">RISK <span className="text-destructive">ASSESSMENT</span></h1>
//           <p className="text-muted-foreground text-xs lcd-text">Threat Vectors & Investment Security</p>
//         </div>
//         <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">Critical Monitoring On</Badge>
//       </header>

//       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
//         <div className="lg:col-span-1 space-y-6">
//           <Card className="scada-panel border-destructive/20">
//             <CardContent className="p-6 text-center">
//               <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-2" />
//               <p className="text-xs lcd-text text-muted-foreground">Composite Risk Index</p>
//               <p className="text-5xl data-value-destructive">68.4</p>
//               <div className="mt-4 p-2 bg-destructive/10 rounded border border-destructive/20">
//                 <p className="text-[10px] text-destructive font-bold uppercase italic">Action Required</p>
//               </div>
//             </CardContent>
//           </Card>

//           <Card className="scada-panel">
//             <CardHeader className="pb-2">
//               <CardTitle className="text-xs lcd-text text-white/70">Risk Vectors</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-3">
//               {[
//                 { label: "Market Saturation", val: 82 },
//                 { label: "Op-Cost Volatility", val: 45 },
//                 { label: "Competitor Agility", val: 74 },
//                 { label: "Regulatory Flux", val: 29 },
//               ].map(v => (
//                 <div key={v.label} className="space-y-1">
//                   <div className="flex justify-between text-[10px] uppercase font-mono">
//                     <span className="text-muted-foreground">{v.label}</span>
//                     <span className={v.val > 70 ? 'text-destructive' : 'text-primary'}>{v.val}%</span>
//                   </div>
//                   <div className="h-1 bg-white/5 rounded-full overflow-hidden">
//                     <div className={`h-full ${v.val > 70 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${v.val}%` }} />
//                   </div>
//                 </div>
//               ))}
//             </CardContent>
//           </Card>
//         </div>

//         <div className="lg:col-span-3">
//           <Card className="scada-panel h-full">
//             <CardHeader>
//               <CardTitle className="text-lg font-display flex items-center gap-2">
//                 <Activity className="w-5 h-5 text-destructive" />
//                 Live Incident Log
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-4">
//                 {[
//                   { time: "14:22:01", msg: "New competitor entity detected in sector 4-G", type: "warning", icon: AlertTriangle },
//                   { time: "13:45:12", msg: "Commercial real-estate price spike (+14%)", type: "critical", icon: ShieldAlert },
//                   { time: "11:30:45", msg: "Standard utility cost updated to current market", type: "info", icon: Info },
//                   { time: "09:12:33", msg: "Zone-B demand levels exceeded projections", type: "success", icon: ShieldCheck },
//                 ].map((log, i) => (
//                   <div key={i} className="flex gap-4 p-3 bg-white/5 rounded border border-white/5 font-mono text-sm group hover:bg-white/10 transition-colors">
//                     <span className="text-muted-foreground shrink-0">{log.time}</span>
//                     <log.icon className={`w-4 h-4 shrink-0 mt-0.5 ${log.type === 'critical' ? 'text-destructive' : log.type === 'warning' ? 'text-accent' : 'text-primary'}`} />
//                     <span className="text-white/80">{log.msg}</span>
//                     <Button variant="ghost" size="icon" className="ml-auto h-5 w-5 opacity-0 group-hover:opacity-100"><Search className="w-3 h-3" /></Button>
//                   </div>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div>
//   );
// }




// frontend/src/pages/risk.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  ShieldAlert, Activity, AlertTriangle, ShieldCheck, Info,
  Globe, Target, Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  analyzeScenario,
  fetchPacketHistory,
  AVAILABLE_ZONES,
  BUSINESS_TYPE_MAP,
  getIndicatorColor,
  getIndicatorBg,
  type DashboardSummaryResponse,
  type SensorPacket,
} from "@/services/api";

export default function Risk() {
  const [selectedZone, setSelectedZone] = useState('Waterloo Region');
  const [radius, setRadius] = useState([5]);
  const [businessType, setBusinessType] = useState('coffee');
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [packetHistory, setPacketHistory] = useState<SensorPacket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [result, history] = await Promise.all([
        analyzeScenario({
          selected_zone: selectedZone,
          selected_business_type: BUSINESS_TYPE_MAP[businessType] || "Coffee Shop",
          radius_km: radius[0],
        }),
        fetchPacketHistory("people_location").catch(() => ({ packets: [] as SensorPacket[], count: 0, sensor_type: "people_location" })),
      ]);
      setData(result);
      setPacketHistory(history.packets.slice(-6).reverse());
    } catch (err) {
      console.error("Failed to fetch risk data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedZone, radius, businessType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const riskMonitor = data?.risk_monitor;
  const compMonitor = data?.competition_monitor;
  const packet = data?.people_location_packet;

  // Derive risk score from indicator
  const riskScoreMap: Record<string, number> = { green: 25, yellow: 55, red: 82 };
  const compositeRisk = riskMonitor ? riskScoreMap[riskMonitor.indicator] ?? 50 : 50;

  // Derive risk vectors from monitors
  const riskVectors = [
    { label: "Market Saturation", val: compMonitor?.indicator === 'red' ? 82 : compMonitor?.indicator === 'yellow' ? 55 : 28 },
    { label: "Op-Cost Volatility", val: radius[0] > 10 ? 65 : 40 },
    { label: "Competitor Agility", val: compMonitor?.indicator === 'red' ? 74 : compMonitor?.indicator === 'yellow' ? 48 : 22 },
    { label: "Regulatory Flux", val: 29 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-white">RISK <span className="text-destructive">ASSESSMENT</span></h1>
          <p className="text-muted-foreground text-xs lcd-text">Threat Vectors & Investment Security — Live Backend Data</p>
        </div>
        <Badge className={`${riskMonitor?.indicator === 'red' ? 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse' : riskMonitor?.indicator === 'yellow' ? 'bg-accent/20 text-accent border-accent/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
          {riskMonitor?.indicator === 'red' ? 'Critical Monitoring On' : riskMonitor?.indicator === 'yellow' ? 'Moderate Alert' : 'Risk Acceptable'}
        </Badge>
      </header>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="space-y-2">
          <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Zone</label>
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {AVAILABLE_ZONES.map(z => <SelectItem key={z} value={z} className="font-mono text-sm">{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Radius</label>
            <span className="text-primary font-mono text-sm">{radius} km</span>
          </div>
          <Slider value={radius} onValueChange={setRadius} max={20} min={1} step={1} />
        </div>
        <div className="space-y-2">
          <label className="text-xs lcd-text text-muted-foreground">Business Type</label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="coffee" className="font-mono text-sm">Coffee Shop</SelectItem>
              <SelectItem value="fitness" className="font-mono text-sm">Fitness Center</SelectItem>
              <SelectItem value="retail" className="font-mono text-sm">Retail Store</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Risk Monitor Banner */}
      {riskMonitor && (
        <div className={`mb-8 p-4 rounded-lg border ${getIndicatorBg(riskMonitor.indicator)}`}>
          <p className="text-xs lcd-text text-muted-foreground mb-1">{riskMonitor.name} Assessment</p>
          <p className="font-mono text-white/90">{riskMonitor.value}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className={`scada-panel ${riskMonitor?.indicator === 'red' ? 'border-destructive/20' : 'border-white/5'}`}>
            <CardContent className="p-6 text-center">
              <ShieldAlert className={`w-12 h-12 mx-auto mb-2 ${getIndicatorColor(riskMonitor?.indicator ?? 'yellow')}`} />
              <p className="text-xs lcd-text text-muted-foreground">Composite Risk Index</p>
              <p className={`text-5xl font-mono font-bold ${getIndicatorColor(riskMonitor?.indicator ?? 'yellow')}`}>{compositeRisk.toFixed(1)}</p>
              <div className={`mt-4 p-2 rounded border ${getIndicatorBg(riskMonitor?.indicator ?? 'yellow')}`}>
                <p className={`text-[10px] font-bold uppercase italic ${getIndicatorColor(riskMonitor?.indicator ?? 'yellow')}`}>
                  {riskMonitor?.indicator === 'red' ? 'Action Required' : riskMonitor?.indicator === 'yellow' ? 'Monitor Closely' : 'Within Limits'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="scada-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lcd-text text-white/70">Risk Vectors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {riskVectors.map(v => (
                <div key={v.label} className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-mono">
                    <span className="text-muted-foreground">{v.label}</span>
                    <span className={v.val > 70 ? 'text-destructive' : v.val > 45 ? 'text-accent' : 'text-emerald-400'}>{v.val}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${v.val > 70 ? 'bg-destructive' : v.val > 45 ? 'bg-accent' : 'bg-emerald-400'}`} style={{ width: `${v.val}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="scada-panel h-full">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Activity className="w-5 h-5 text-destructive" />
                Sensor Packet History
                <Badge variant="outline" className="ml-auto text-[10px] border-primary/20 text-primary">{packetHistory.length} records</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {packetHistory.length === 0 && (
                  <p className="text-muted-foreground text-center py-8 lcd-text">No packet history yet. Interact with the dashboard to generate sensor data.</p>
                )}
                {packetHistory.map((pkt, i) => {
                  const icon = pkt.indicator === 'red' ? ShieldAlert : pkt.indicator === 'yellow' ? AlertTriangle : ShieldCheck;
                  const IconComponent = icon;
                  const ts = new Date(pkt.timestamp).toLocaleTimeString();
                  return (
                    <div key={i} className="flex gap-4 p-3 bg-white/5 rounded border border-white/5 font-mono text-sm group hover:bg-white/10 transition-colors">
                      <span className="text-muted-foreground shrink-0">{ts}</span>
                      <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${getIndicatorColor(pkt.indicator)}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-white/80 block">{pkt.summary_text}</span>
                        <span className="text-[10px] text-muted-foreground">{pkt.selected_zone} · {pkt.radius_km}km · {pkt.selected_business_type}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] uppercase ${getIndicatorColor(pkt.indicator)} border-current shrink-0`}>{pkt.indicator}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
