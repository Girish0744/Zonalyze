// import React from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { 
//   Briefcase, BarChart3, PieChart, TrendingUp, 
//   ArrowUpRight, ArrowDownRight, DollarSign, Target
// } from 'lucide-react';

// const projections = [
//   { month: "M1", rev: "$42k", cost: "$28k", margin: "33%" },
//   { month: "M2", rev: "$45k", cost: "$28k", margin: "37%" },
//   { month: "M3", rev: "$52k", cost: "$29k", margin: "44%" },
//   { month: "M4", rev: "$58k", cost: "$30k", margin: "48%" },
// ];

// export default function BusinessCase() {
//   return (
//     <div className="min-h-screen bg-background text-foreground p-6 font-sans">
//       <header className="mb-8 border-b border-white/10 pb-4">
//         <h1 className="text-3xl font-display font-bold tracking-wider text-white">BUSINESS <span className="text-accent">MODELER</span></h1>
//         <p className="text-muted-foreground text-xs lcd-text">Financial Forecasting & Viability Matrix</p>
//       </header>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//         {[
//           { label: "Est. Breakeven", val: "14 Mo", icon: Target, color: "text-primary" },
//           { label: "Avg. Transaction", val: "$18.50", icon: DollarSign, color: "text-accent" },
//           { label: "ROI Projection", val: "22.4%", icon: TrendingUp, color: "text-emerald-400" },
//           { label: "Market Share", val: "4.2%", icon: Briefcase, color: "text-primary" },
//         ].map(kpi => (
//           <Card key={kpi.label} className="scada-panel">
//             <CardContent className="p-5 flex items-center gap-4">
//               <div className={`p-3 rounded-lg bg-white/5 border border-white/10 ${kpi.color}`}>
//                 <kpi.icon className="w-6 h-6" />
//               </div>
//               <div>
//                 <p className="text-[10px] lcd-text text-muted-foreground">{kpi.label}</p>
//                 <p className="text-xl font-mono text-white">{kpi.val}</p>
//               </div>
//             </CardContent>
//           </Card>
//         ))}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         <Card className="scada-panel lg:col-span-2">
//           <CardHeader>
//             <CardTitle className="text-lg font-display flex items-center justify-between">
//               <div className="flex items-center gap-2">
//                 <BarChart3 className="w-5 h-5 text-accent" />
//                 Quarterly Trajectory
//               </div>
//               <Badge variant="outline" className="text-[10px] border-accent/20 text-accent">Simulated</Badge>
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="w-full overflow-x-auto">
//               <table className="w-full text-left font-mono text-sm">
//                 <thead>
//                   <tr className="text-[10px] uppercase text-muted-foreground border-b border-white/5">
//                     <th className="pb-4 px-2">Timeline</th>
//                     <th className="pb-4 px-2">Projected Revenue</th>
//                     <th className="pb-4 px-2">Operating Costs</th>
//                     <th className="pb-4 px-2">Net Margin</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-white/5">
//                   {projections.map(p => (
//                     <tr key={p.month} className="group hover:bg-white/5 transition-colors">
//                       <td className="py-4 px-2 text-white">{p.month}</td>
//                       <td className="py-4 px-2 text-primary font-bold">{p.rev}</td>
//                       <td className="py-4 px-2 text-muted-foreground">{p.cost}</td>
//                       <td className="py-4 px-2 text-accent">{p.margin}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </CardContent>
//         </Card>

//         <Card className="scada-panel">
//           <CardHeader>
//             <CardTitle className="text-lg font-display flex items-center gap-2">
//               <PieChart className="w-5 h-5 text-primary" />
//               Capital Allocation
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-6">
//               {[
//                 { label: "Infrastructure", val: 45, color: "bg-primary" },
//                 { label: "Inventory/Stock", val: 25, color: "bg-accent" },
//                 { label: "Marketing", val: 15, color: "bg-emerald-500" },
//                 { label: "Reserve Fund", val: 15, color: "bg-muted-foreground" },
//               ].map(item => (
//                 <div key={item.label} className="space-y-2">
//                   <div className="flex justify-between text-xs font-mono uppercase tracking-widest">
//                     <span className="text-muted-foreground">{item.label}</span>
//                     <span className="text-white">{item.val}%</span>
//                   </div>
//                   <div className="h-2 bg-white/5 rounded-full overflow-hidden">
//                     <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }} />
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }


// frontend/src/pages/business-case.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Briefcase, BarChart3, PieChart, TrendingUp,
  DollarSign, Target, Globe
} from 'lucide-react';
import {
  analyzeScenario,
  AVAILABLE_ZONES,
  BUSINESS_TYPE_MAP,
  getIndicatorColor,
  getIndicatorBg,
  type DashboardSummaryResponse,
} from "@/services/api";

export default function BusinessCase() {
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
      console.error("Failed to fetch business data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedZone, radius, businessType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const revMonitor = data?.revenue_monitor;
  const compMonitor = data?.competition_monitor;
  const packet = data?.people_location_packet;
  const popMetric = packet?.metrics.find(m => m.key === "population_total");
  const population = popMetric?.value ?? 0;

  // Computed financial projections based on real backend data
  const avgTransaction = businessType === 'coffee' ? 8.5 : businessType === 'fitness' ? 45 : 22;
  const dailyCustomers = Math.floor(population / 100);
  const monthlyRevenue = dailyCustomers * avgTransaction * 30;
  const monthlyCost = 15000 + (radius[0] * 500);
  const netMarginPct = monthlyRevenue > 0 ? Math.round(((monthlyRevenue - monthlyCost) / monthlyRevenue) * 100) : 0;
  const breakeven = monthlyCost > 0 ? Math.ceil(50000 / Math.max(1, monthlyRevenue - monthlyCost)) : 99;
  const roi = monthlyCost > 0 ? ((monthlyRevenue - monthlyCost) / monthlyCost * 100).toFixed(1) : "0";
  const marketShare = population > 0 ? (dailyCustomers / population * 100).toFixed(1) : "0";

  const projections = [
    { month: "M1", rev: `$${(monthlyRevenue * 0.7 / 1000).toFixed(0)}k`, cost: `$${(monthlyCost / 1000).toFixed(0)}k`, margin: `${Math.max(0, netMarginPct - 15)}%` },
    { month: "M2", rev: `$${(monthlyRevenue * 0.85 / 1000).toFixed(0)}k`, cost: `$${(monthlyCost / 1000).toFixed(0)}k`, margin: `${Math.max(0, netMarginPct - 8)}%` },
    { month: "M3", rev: `$${(monthlyRevenue * 0.95 / 1000).toFixed(0)}k`, cost: `$${(monthlyCost * 1.02 / 1000).toFixed(0)}k`, margin: `${Math.max(0, netMarginPct - 3)}%` },
    { month: "M4", rev: `$${(monthlyRevenue / 1000).toFixed(0)}k`, cost: `$${(monthlyCost * 1.03 / 1000).toFixed(0)}k`, margin: `${netMarginPct}%` },
  ];

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-display font-bold tracking-wider text-white">BUSINESS <span className="text-accent">MODELER</span></h1>
        <p className="text-muted-foreground text-xs lcd-text">Financial Forecasting & Viability Matrix — Backend-Driven</p>
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

      {/* Revenue Monitor Banner */}
      {revMonitor && (
        <div className={`mb-8 p-4 rounded-lg border ${getIndicatorBg(revMonitor.indicator)}`}>
          <p className="text-xs lcd-text text-muted-foreground mb-1">{revMonitor.name} Assessment</p>
          <p className="font-mono text-white/90">{revMonitor.value}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Est. Breakeven", val: `${breakeven} Mo`, icon: Target, color: "text-primary" },
          { label: "Avg. Transaction", val: `$${avgTransaction.toFixed(2)}`, icon: DollarSign, color: "text-accent" },
          { label: "ROI Projection", val: `${roi}%`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Market Share", val: `${marketShare}%`, icon: Briefcase, color: "text-primary" },
        ].map(kpi => (
          <Card key={kpi.label} className="scada-panel">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-lg bg-white/5 border border-white/10 ${kpi.color}`}>
                <kpi.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] lcd-text text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-mono text-white">{kpi.val}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="scada-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                Quarterly Trajectory
              </div>
              <Badge variant="outline" className="text-[10px] border-accent/20 text-accent">Backend Data</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left font-mono text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-muted-foreground border-b border-white/5">
                    <th className="pb-4 px-2">Timeline</th>
                    <th className="pb-4 px-2">Projected Revenue</th>
                    <th className="pb-4 px-2">Operating Costs</th>
                    <th className="pb-4 px-2">Net Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {projections.map(p => (
                    <tr key={p.month} className="group hover:bg-white/5 transition-colors">
                      <td className="py-4 px-2 text-white">{p.month}</td>
                      <td className="py-4 px-2 text-primary font-bold">{p.rev}</td>
                      <td className="py-4 px-2 text-muted-foreground">{p.cost}</td>
                      <td className="py-4 px-2 text-accent">{p.margin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="scada-panel">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Capital Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { label: "Infrastructure", val: 45, color: "bg-primary" },
                { label: "Inventory/Stock", val: 25, color: "bg-accent" },
                { label: "Marketing", val: 15, color: "bg-emerald-500" },
                { label: "Reserve Fund", val: 15, color: "bg-muted-foreground" },
              ].map(item => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-xs font-mono uppercase tracking-widest">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-white">{item.val}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
