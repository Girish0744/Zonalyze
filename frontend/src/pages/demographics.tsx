// import React from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { 
//   Users, TrendingUp, MapPin, Search, 
//   Filter, Layers, ArrowRight, MousePointer2 
// } from 'lucide-react';

// const mockSegments = [
//   { id: 1, name: "Young Professionals", size: "28%", growth: "+4.2%", affinity: "High" },
//   { id: 2, name: "Family Households", size: "35%", growth: "-1.1%", affinity: "Medium" },
//   { id: 3, name: "Retirees", size: "15%", growth: "+0.8%", affinity: "Low" },
//   { id: 4, name: "Students", size: "22%", growth: "+12.4%", affinity: "Very High" },
// ];

// export default function Demographics() {
//   return (
//     <div className="min-h-screen bg-background text-foreground p-6 font-sans">
//       <header className="mb-8 border-b border-white/10 pb-4">
//         <h1 className="text-3xl font-display font-bold tracking-wider text-white">DEMOGRAPHIC <span className="text-primary">ANALYTICS</span></h1>
//         <p className="text-muted-foreground text-xs lcd-text">Population Intelligence & Segmentation</p>
//       </header>

//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//         <Card className="scada-panel">
//           <CardContent className="p-6">
//             <div className="flex justify-between items-start mb-4">
//               <Users className="w-8 h-8 text-primary opacity-50" />
//               <Badge variant="outline" className="border-primary/30 text-primary">Live</Badge>
//             </div>
//             <h3 className="text-sm lcd-text text-muted-foreground">Total Catchment</h3>
//             <p className="text-4xl data-value">128,402</p>
//           </CardContent>
//         </Card>

//         <Card className="scada-panel">
//           <CardContent className="p-6">
//             <div className="flex justify-between items-start mb-4">
//               <TrendingUp className="w-8 h-8 text-accent opacity-50" />
//               <Badge variant="outline" className="border-accent/30 text-accent">+12%</Badge>
//             </div>
//             <h3 className="text-sm lcd-text text-muted-foreground">Growth Projection</h3>
//             <p className="text-4xl data-value-accent">High</p>
//           </CardContent>
//         </Card>

//         <Card className="scada-panel">
//           <CardContent className="p-6">
//             <div className="flex justify-between items-start mb-4">
//               <MapPin className="w-8 h-8 text-emerald-500 opacity-50" />
//               <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">Core</Badge>
//             </div>
//             <h3 className="text-sm lcd-text text-muted-foreground">Density Index</h3>
//             <p className="text-4xl data-value text-emerald-400">9.2</p>
//           </CardContent>
//         </Card>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <Card className="scada-panel">
//           <CardHeader>
//             <CardTitle className="text-lg font-display flex items-center gap-2">
//               <Layers className="w-5 h-5 text-primary" />
//               Segment Breakdown
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-4">
//               {mockSegments.map(s => (
//                 <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5 hover:border-primary/30 transition-colors">
//                   <div>
//                     <p className="font-mono text-white">{s.name}</p>
//                     <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Market Size: {s.size}</p>
//                   </div>
//                   <div className="text-right">
//                     <p className={`font-mono ${s.growth.startsWith('+') ? 'text-emerald-400' : 'text-destructive'}`}>{s.growth}</p>
//                     <Badge variant="secondary" className="text-[10px] h-4">{s.affinity} Affinity</Badge>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>

//         <Card className="scada-panel flex items-center justify-center min-h-[300px] border-dashed border-white/10">
//           <div className="text-center p-8">
//             <MousePointer2 className="w-12 h-12 text-primary/20 mx-auto mb-4 animate-bounce" />
//             <p className="text-muted-foreground lcd-text uppercase tracking-widest text-sm">Interactive Map Engine</p>
//             <p className="text-[10px] text-muted-foreground mt-2 max-w-[200px]">Layer selection required to initialize spatial visualization</p>
//             <div className="flex gap-2 mt-4 justify-center">
//               <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase border-primary/20">Income Heatmap</Button>
//               <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase border-primary/20">Age Clusters</Button>
//             </div>
//           </div>
//         </Card>
//       </div>
//     </div>
//   );
// }


// frontend/src/pages/demographics.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Users, TrendingUp, MapPin,
  Layers, Target, Globe
} from 'lucide-react';
import {
  analyzeScenario,
  AVAILABLE_ZONES,
  BUSINESS_TYPE_MAP,
  getIndicatorColor,
  getIndicatorBg,
  type DashboardSummaryResponse,
} from "@/services/api";

export default function Demographics() {
  const [selectedZone, setSelectedZone] = useState('Waterloo Region');
  const [radius, setRadius] = useState([5]);
  const [businessType, setBusinessType] = useState('coffee');
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await analyzeScenario({
        selected_zone: selectedZone,
        selected_business_type: BUSINESS_TYPE_MAP[businessType] || "Coffee Shop",
        radius_km: radius[0],
      });
      setData(result);
    } catch (err) {
      console.error("Failed to fetch demographic data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedZone, radius, businessType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const packet = data?.people_location_packet;
  const popMetric = packet?.metrics.find(m => m.key === "population_total");
  const studentsMetric = packet?.metrics.find(m => m.key === "students_pct");
  const familiesMetric = packet?.metrics.find(m => m.key === "families_pct");
  const retireesMetric = packet?.metrics.find(m => m.key === "retirees_pct");

  const segments = [
    {
      id: 1,
      name: "Students",
      size: `${studentsMetric?.value ?? 0}%`,
      growth: studentsMetric && studentsMetric.value > 50 ? "+High" : "+Moderate",
      affinity: studentsMetric && studentsMetric.value > 50 ? "Very High" : "Medium",
    },
    {
      id: 2,
      name: "Family Households",
      size: `${familiesMetric?.value ?? 0}%`,
      growth: familiesMetric && familiesMetric.value > 40 ? "+Growing" : "Stable",
      affinity: familiesMetric && familiesMetric.value > 30 ? "High" : "Medium",
    },
    {
      id: 3,
      name: "Retirees",
      size: `${retireesMetric?.value ?? 0}%`,
      growth: "Stable",
      affinity: retireesMetric && retireesMetric.value > 20 ? "Medium" : "Low",
    },
  ];

  const densityIndex = popMetric ? (popMetric.value / (radius[0] * radius[0] * Math.PI)).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-display font-bold tracking-wider text-white">DEMOGRAPHIC <span className="text-primary">ANALYTICS</span></h1>
        <p className="text-muted-foreground text-xs lcd-text">Population Intelligence & Segmentation — Powered by Backend Sensors</p>
      </header>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="space-y-2">
          <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
            <Globe className="w-3 h-3" /> Target Zone
          </label>
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {AVAILABLE_ZONES.map(zone => (
                <SelectItem key={zone} value={zone} className="font-mono text-sm">{zone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
              <Target className="w-3 h-3" /> Radius
            </label>
            <span className="text-primary font-mono text-sm">{radius} km</span>
          </div>
          <Slider value={radius} onValueChange={setRadius} max={20} min={1} step={1} />
        </div>
        <div className="space-y-2">
          <label className="text-xs lcd-text text-muted-foreground">Business Type</label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="coffee" className="font-mono text-sm">Coffee Shop</SelectItem>
              <SelectItem value="fitness" className="font-mono text-sm">Fitness Center</SelectItem>
              <SelectItem value="retail" className="font-mono text-sm">Retail Store</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sensor Summary Banner */}
      {packet && (
        <div className={`mb-6 p-3 rounded-lg border flex items-center gap-3 ${getIndicatorBg(packet.indicator)}`}>
          <MapPin className={`w-5 h-5 ${getIndicatorColor(packet.indicator)}`} />
          <p className="text-xs font-mono text-white/90 flex-1">{packet.summary_text}</p>
          <Badge variant="outline" className={`uppercase text-[10px] ${getIndicatorColor(packet.indicator)} border-current`}>
            {packet.indicator}
          </Badge>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="scada-panel">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <Users className="w-8 h-8 text-primary opacity-50" />
              <Badge variant="outline" className={`${packet ? getIndicatorColor(packet.indicator) : 'text-muted-foreground'} border-current`}>
                {loading ? 'Loading...' : 'Live'}
              </Badge>
            </div>
            <h3 className="text-sm lcd-text text-muted-foreground">Total Catchment</h3>
            <p className="text-4xl data-value">{popMetric?.value.toLocaleString() ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{popMetric?.unit ?? ''}</p>
          </CardContent>
        </Card>

        <Card className="scada-panel">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <TrendingUp className="w-8 h-8 text-accent opacity-50" />
              <Badge variant="outline" className={`${packet ? getIndicatorColor(packet.indicator) : 'text-muted-foreground'} border-current`}>
                {packet?.indicator ?? '—'}
              </Badge>
            </div>
            <h3 className="text-sm lcd-text text-muted-foreground">Zone Indicator</h3>
            <p className={`text-4xl ${packet ? getIndicatorColor(packet.indicator) : ''} font-mono font-bold uppercase`}>
              {packet?.indicator ?? '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="scada-panel">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <MapPin className="w-8 h-8 text-emerald-500 opacity-50" />
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">Density</Badge>
            </div>
            <h3 className="text-sm lcd-text text-muted-foreground">Density Index</h3>
            <p className="text-4xl data-value text-emerald-400">{densityIndex}</p>
            <p className="text-[10px] text-muted-foreground mt-1">people / km²</p>
          </CardContent>
        </Card>
      </div>

      {/* Segments + Metrics Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="scada-panel">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Segment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {segments.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5 hover:border-primary/30 transition-colors">
                  <div>
                    <p className="font-mono text-white">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Market Size: {s.size}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono ${s.growth.startsWith('+') ? 'text-emerald-400' : 'text-accent'}`}>{s.growth}</p>
                    <Badge variant="secondary" className="text-[10px] h-4">{s.affinity} Affinity</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="scada-panel">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Raw Metric Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {packet?.metrics.map(m => (
                <div key={m.key} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5">
                  <div>
                    <p className="font-mono text-white text-sm">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Key: {m.key}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-mono text-primary font-bold">{m.value.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                  </div>
                </div>
              )) ?? (
                  <p className="text-muted-foreground text-center py-8 lcd-text">No data available</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
