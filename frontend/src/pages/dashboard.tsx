// // frontend/src/pages/dashboard.tsx

// import React, { useState, useEffect, useCallback } from 'react';
// import {
//   Activity, MapPin, DollarSign, Users, AlertTriangle,
//   TrendingUp, Download, Settings, Target, Signal, Store,
//   BarChart4, Crosshair, ShieldAlert, Cpu, Zap, Globe
// } from 'lucide-react';
// import { Slider } from "@/components/ui/slider";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
// import { useToast } from "@/hooks/use-toast";
// import { Link, useLocation } from "wouter";

// import {
//   analyzeScenario,
//   AVAILABLE_ZONES,
//   BUSINESS_TYPE_MAP,
//   getIndicatorColor,
//   getIndicatorBg,
//   type DashboardSummaryResponse,
//   type MonitorStatus,
// } from "@/services/api";

// // --- Trend Data Generator (for chart animation) ---
// const generateTrendData = (baseVal: number) => {
//   return Array.from({ length: 12 }).map((_, i) => ({
//     time: `${i * 2}h`,
//     value: baseVal + (Math.random() * (baseVal * 0.2)) - (baseVal * 0.1)
//   }));
// };

// export default function Dashboard() {
//   const { toast } = useToast();
//   const [location] = useLocation();

//   // -- Control State --
//   const [selectedZone, setSelectedZone] = useState('Waterloo Region');
//   const [radius, setRadius] = useState([5]);
//   const [businessType, setBusinessType] = useState('coffee');
//   const [opCosts, setOpCosts] = useState([15000]);
//   const [demandMultiplier, setDemandMultiplier] = useState([1.2]);
//   const [riskTolerance, setRiskTolerance] = useState('medium');
//   const [pricing, setPricing] = useState([2]);

//   // -- Backend Data State --
//   const [lastUpdate, setLastUpdate] = useState(new Date());
//   const [isUpdating, setIsUpdating] = useState(false);
//   const [backendData, setBackendData] = useState<DashboardSummaryResponse | null>(null);

//   // -- Derived Metrics State --
//   const [metrics, setMetrics] = useState({
//     population: 0,
//     competitors: 0,
//     crowding: 0,
//     customersDay: 0,
//     revenueMonth: 0,
//     riskScore: 0,
//     sustainability: 0,
//     ageData: [] as { group: string; value: number }[],
//     revenueTrend: generateTrendData(0),
//     footTraffic: generateTrendData(0),
//   });

//   // -- Fetch from Backend --
//   const recalculateMetrics = useCallback(async () => {
//     setIsUpdating(true);

//     try {
//       const data = await analyzeScenario({
//         selected_zone: selectedZone,
//         selected_business_type: BUSINESS_TYPE_MAP[businessType] || "Coffee Shop",
//         radius_km: radius[0],
//       });

//       setBackendData(data);

//       const packet = data.people_location_packet;
//       const popMetric = packet.metrics.find((m) => m.key === "population_total");
//       const studentsMetric = packet.metrics.find((m) => m.key === "students_pct");
//       const familiesMetric = packet.metrics.find((m) => m.key === "families_pct");
//       const retireesMetric = packet.metrics.find((m) => m.key === "retirees_pct");

//       const population = popMetric?.value ?? 0;
//       const demandMult = demandMultiplier[0];
//       const newCust = Math.floor((population / 100) * demandMult);
//       const newRev = newCust * (pricing[0] * 15) * 30;
//       const newComp = Math.floor(12 * (radius[0] / 5));
//       const newRisk = Math.min(100, Math.floor((newComp * 2) + (opCosts[0] / 1000) - (demandMult * 10)));

//       setMetrics({
//         population,
//         competitors: newComp,
//         crowding: Math.min(100, Math.floor(60 * (radius[0] / 5) + Math.random() * 10)),
//         customersDay: newCust,
//         revenueMonth: newRev,
//         riskScore: newRisk,
//         sustainability: Math.max(0, 100 - newRisk + (demandMult * 5)),
//         ageData: [
//           { group: "Students", value: studentsMetric?.value ?? 0 },
//           { group: "Families", value: familiesMetric?.value ?? 0 },
//           { group: "Retirees", value: retireesMetric?.value ?? 0 },
//         ],
//         revenueTrend: generateTrendData(newRev),
//         footTraffic: generateTrendData(newCust),
//       });

//       setLastUpdate(new Date());
//     } catch (err) {
//       console.error("Failed to fetch from backend:", err);
//       toast({
//         title: "Connection Error",
//         description: "Could not reach the backend API. Is it running?",
//         variant: "destructive",
//         duration: 4000,
//       });
//     } finally {
//       setIsUpdating(false);
//     }
//   }, [selectedZone, radius, businessType, opCosts, demandMultiplier, pricing, toast]);

//   // -- Trigger on dial change --
//   useEffect(() => {
//     recalculateMetrics();
//   }, [recalculateMetrics]);

//   // -- Auto-refresh every 30 seconds --
//   useEffect(() => {
//     const interval = setInterval(() => {
//       recalculateMetrics();
//     }, 30000);
//     return () => clearInterval(interval);
//   }, [recalculateMetrics]);

//   const handleExport = () => {
//     toast({
//       title: "Generating Feasibility Report",
//       description: "Compiling business intelligence data into PDF format...",
//       duration: 3000,
//     });
//   };

//   const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

//   // -- Helper to render a MonitorStatus card --
//   const renderMonitorCard = (monitor: MonitorStatus | undefined, icon: React.ReactNode) => {
//     if (!monitor) return null;
//     return (
//       <Card className={`scada-panel border ${getIndicatorBg(monitor.indicator)}`}>
//         <CardContent className="p-5 flex items-start gap-4">
//           <div className={`p-2 rounded-lg bg-white/5 ${getIndicatorColor(monitor.indicator)}`}>
//             {icon}
//           </div>
//           <div className="flex-1 min-w-0">
//             <p className="text-xs lcd-text text-muted-foreground mb-1">{monitor.name} Monitor</p>
//             <p className="text-sm font-mono text-white/90 leading-relaxed">{monitor.value}</p>
//             <Badge variant="outline" className={`mt-2 text-[10px] uppercase ${getIndicatorColor(monitor.indicator)} border-current`}>
//               {monitor.indicator}
//             </Badge>
//           </div>
//         </CardContent>
//       </Card>
//     );
//   };

//   return (
//     <div className="min-h-screen bg-background text-foreground flex flex-col font-sans p-4 lg:p-6 overflow-x-hidden">

//       {/* HEADER */}
//       <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-4 border-b border-white/10 gap-4">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 bg-primary/20 rounded-md flex items-center justify-center border border-primary/50 relative overflow-hidden">
//             <Activity className="text-primary w-6 h-6 z-10" />
//             <div className="absolute inset-0 bg-primary/20 animate-pulse"></div>
//           </div>
//           <div>
//             <h1 className="text-2xl md:text-3xl font-display font-bold tracking-wider text-white">ZONALYZE <span className="text-primary text-sm tracking-widest uppercase">Sys.Core</span></h1>
//             <p className="text-muted-foreground text-xs lcd-text">
//               {backendData ? backendData.project_phase : 'Connecting to backend...'}
//             </p>
//           </div>
//         </div>

//         {/* NAVIGATION LINKS */}
//         <nav className="flex items-center gap-1 md:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
//           {[
//             { label: 'Core', path: '/' },
//             { label: 'Demographics', path: '/demographics' },
//             { label: 'Risk', path: '/risk' },
//             { label: 'Business', path: '/business-case' },
//             { label: 'Spatial', path: '/geospatial' },
//           ].map(link => (
//             <Link key={link.path} href={link.path} className={`text-[10px] lcd-text px-3 py-1.5 rounded border transition-all uppercase tracking-widest inline-block ${location === link.path ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'}`}>
//               {link.label}
//             </Link>
//           ))}
//         </nav>

//         <div className="flex items-center gap-4">
//           <div className="flex items-center gap-2 bg-card/40 px-3 py-1.5 rounded-md border border-white/5 backdrop-blur-md">
//             <Signal className={`w-4 h-4 ${isUpdating ? 'text-accent animate-pulse' : 'text-emerald-400'}`} />
//             <span className="text-xs lcd-text text-white/80">
//               LIVE SYNC: {isUpdating ? 'CALCULATING...' : lastUpdate.toLocaleTimeString()}
//             </span>
//           </div>
//           <Button
//             variant="outline"
//             className="bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary-foreground font-mono text-sm uppercase tracking-wider"
//             onClick={handleExport}
//             data-testid="btn-export-pdf"
//           >
//             <Download className="w-4 h-4 mr-2" />
//             Export Report
//           </Button>
//         </div>
//       </header>

//       {/* SENSOR SUMMARY BANNER */}
//       {backendData && (
//         <div className={`mb-6 p-3 rounded-lg border flex items-center gap-3 ${getIndicatorBg(backendData.people_location_packet.indicator)}`}>
//           <Globe className={`w-5 h-5 ${getIndicatorColor(backendData.people_location_packet.indicator)}`} />
//           <div className="flex-1">
//             <p className="text-xs font-mono text-white/90">{backendData.people_location_packet.summary_text}</p>
//             <p className="text-[10px] text-muted-foreground mt-0.5">
//               Zone: {backendData.selected_zone} · Radius: {backendData.radius_km} km · Type: {backendData.selected_business_type}
//             </p>
//           </div>
//           <Badge variant="outline" className={`uppercase text-[10px] ${getIndicatorColor(backendData.people_location_packet.indicator)} border-current`}>
//             {backendData.people_location_packet.indicator}
//           </Badge>
//         </div>
//       )}

//       <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">

//         {/* LEFT COLUMN: CONTROL DIALS */}
//         <div className="lg:col-span-3 flex flex-col gap-4">
//           <div className="flex items-center gap-2 mb-2">
//             <Settings className="w-5 h-5 text-muted-foreground" />
//             <h2 className="text-lg font-display text-white/90">Control Dials</h2>
//           </div>

//           <Card className="scada-panel border-white/5">
//             <CardContent className="p-5 space-y-6">

//               {/* Dial 0: Zone Selector */}
//               <div className="space-y-3">
//                 <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
//                   <Globe className="w-3 h-3" /> Target Zone
//                 </label>
//                 <Select value={selectedZone} onValueChange={setSelectedZone}>
//                   <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
//                     <SelectValue placeholder="Select zone" />
//                   </SelectTrigger>
//                   <SelectContent className="bg-card border-white/10">
//                     {AVAILABLE_ZONES.map(zone => (
//                       <SelectItem key={zone} value={zone} className="font-mono text-sm">{zone}</SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               {/* Dial 1: Radius */}
//               <div className="space-y-3">
//                 <div className="flex justify-between items-center">
//                   <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
//                     <Target className="w-3 h-3" /> Search Radius
//                   </label>
//                   <span className="text-primary font-mono text-sm font-bold">{radius} km</span>
//                 </div>
//                 <Slider
//                   value={radius} onValueChange={setRadius} max={20} min={1} step={1}
//                   className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
//                 />
//               </div>

//               {/* Dial 2: Business Type */}
//               <div className="space-y-3">
//                 <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
//                   <Store className="w-3 h-3" /> Venture Type
//                 </label>
//                 <Select value={businessType} onValueChange={setBusinessType}>
//                   <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
//                     <SelectValue placeholder="Select type" />
//                   </SelectTrigger>
//                   <SelectContent className="bg-card border-white/10">
//                     <SelectItem value="coffee" className="font-mono text-sm">Coffee Shop / Cafe</SelectItem>
//                     <SelectItem value="fitness" className="font-mono text-sm">Fitness Center</SelectItem>
//                     <SelectItem value="retail" className="font-mono text-sm">Retail Store</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>

//               {/* Dial 3: Op Costs */}
//               <div className="space-y-3">
//                 <div className="flex justify-between items-center">
//                   <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
//                     <DollarSign className="w-3 h-3" /> Est. Monthly Op. Costs
//                   </label>
//                   <span className="text-white/90 font-mono text-sm">{formatCurrency(opCosts[0])}</span>
//                 </div>
//                 <Slider
//                   value={opCosts} onValueChange={setOpCosts} max={50000} min={5000} step={1000}
//                 />
//               </div>

//               {/* Dial 4: Demand Multipliers */}
//               <div className="space-y-3">
//                 <div className="flex justify-between items-center">
//                   <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
//                     <TrendingUp className="w-3 h-3" /> Demand Multiplier
//                   </label>
//                   <span className="text-accent font-mono text-sm font-bold">{demandMultiplier}x</span>
//                 </div>
//                 <Slider
//                   value={demandMultiplier} onValueChange={setDemandMultiplier} max={5} min={0.5} step={0.1}
//                   className="[&_[role=slider]]:bg-accent [&_[role=slider]]:border-accent [&_.bg-primary]:bg-accent"
//                 />
//               </div>

//               {/* Dial 5: Risk Tolerance */}
//               <div className="space-y-3">
//                 <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
//                   <ShieldAlert className="w-3 h-3" /> Risk Tolerance Limit
//                 </label>
//                 <Select value={riskTolerance} onValueChange={setRiskTolerance}>
//                   <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
//                     <SelectValue placeholder="Select level" />
//                   </SelectTrigger>
//                   <SelectContent className="bg-card border-white/10">
//                     <SelectItem value="low" className="font-mono text-sm text-emerald-400">Conservative (Low)</SelectItem>
//                     <SelectItem value="medium" className="font-mono text-sm text-accent">Balanced (Medium)</SelectItem>
//                     <SelectItem value="high" className="font-mono text-sm text-destructive">Aggressive (High)</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>

//               {/* Dial 6: Pricing Strategy */}
//               <div className="space-y-3">
//                 <div className="flex justify-between items-center">
//                   <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
//                     <Crosshair className="w-3 h-3" /> Pricing Strategy
//                   </label>
//                   <span className="text-white/90 font-mono text-sm">
//                     {pricing[0] === 1 ? 'Budget' : pricing[0] === 2 ? 'Standard' : 'Premium'}
//                   </span>
//                 </div>
//                 <Slider
//                   value={pricing} onValueChange={setPricing} max={3} min={1} step={1}
//                 />
//               </div>

//             </CardContent>
//           </Card>

//           <div className="scada-panel p-4 rounded-lg mt-auto">
//             <div className="flex items-center gap-3">
//               <Cpu className="w-8 h-8 text-primary/50 animate-pulse" />
//               <div>
//                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Processing Node</p>
//                 <p className="text-sm font-mono text-primary">ZN-CORE-ACTIVE</p>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* RIGHT AREA: SENSORS & DASHBOARD */}
//         <div className="lg:col-span-9 flex flex-col gap-6">
//           <div className="flex items-center gap-2 mb-[-8px]">
//             <BarChart4 className="w-5 h-5 text-muted-foreground" />
//             <h2 className="text-lg font-display text-white/90">Environment Sensors</h2>
//           </div>

//           {/* Top KPI Row */}
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

//             <Card className="scada-panel relative group">
//               <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 rounded-bl-xl border-b border-l border-primary/20 flex items-center justify-center">
//                 <Users className="w-4 h-4 text-primary" />
//               </div>
//               <CardContent className="p-5">
//                 <p className="text-xs lcd-text text-muted-foreground mb-1">Total Population Density</p>
//                 <p className="text-3xl data-value" data-testid="metric-population">
//                   {metrics.population.toLocaleString()}
//                 </p>
//                 <p className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1">
//                   <TrendingUp className="w-3 h-3" /> from {selectedZone}
//                 </p>
//               </CardContent>
//             </Card>

//             <Card className="scada-panel relative">
//               <div className="absolute top-0 right-0 w-8 h-8 bg-accent/10 rounded-bl-xl border-b border-l border-accent/20 flex items-center justify-center">
//                 <MapPin className="w-4 h-4 text-accent" />
//               </div>
//               <CardContent className="p-5">
//                 <p className="text-xs lcd-text text-muted-foreground mb-1">Competitor Presence</p>
//                 <p className="text-3xl data-value-accent" data-testid="metric-competitors">
//                   {metrics.competitors}
//                 </p>
//                 <p className="text-[10px] text-muted-foreground mt-2">Active entities within {radius}km</p>
//               </CardContent>
//             </Card>

//             <Card className="scada-panel relative">
//               <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 rounded-bl-xl border-b border-l border-primary/20 flex items-center justify-center">
//                 <Zap className="w-4 h-4 text-primary" />
//               </div>
//               <CardContent className="p-5">
//                 <p className="text-xs lcd-text text-muted-foreground mb-1">Expected Customers/Day</p>
//                 <p className="text-3xl data-value text-white" data-testid="metric-customers">
//                   {metrics.customersDay.toLocaleString()}
//                 </p>
//                 <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
//                   <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, (metrics.customersDay / 1000) * 100)}%` }}></div>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="scada-panel relative overflow-hidden">
//               {metrics.riskScore > 70 && <div className="absolute inset-0 bg-destructive/10 animate-pulse pointer-events-none z-0"></div>}
//               <div className="absolute top-0 right-0 w-8 h-8 bg-destructive/10 rounded-bl-xl border-b border-l border-destructive/20 flex items-center justify-center z-10">
//                 <AlertTriangle className={`w-4 h-4 ${metrics.riskScore > 70 ? 'text-destructive animate-bounce' : 'text-muted-foreground'}`} />
//               </div>
//               <CardContent className="p-5 relative z-10">
//                 <p className="text-xs lcd-text text-muted-foreground mb-1">Investment Risk Level</p>
//                 <p className={`text-3xl ${metrics.riskScore > 70 ? 'data-value-destructive' : metrics.riskScore > 40 ? 'data-value-accent' : 'data-value text-emerald-400'}`} data-testid="metric-risk">
//                   {metrics.riskScore}%
//                 </p>
//                 <p className="text-[10px] text-white/60 mt-2 uppercase tracking-widest">
//                   {metrics.riskScore > 70 ? 'High Danger' : metrics.riskScore > 40 ? 'Moderate' : 'Acceptable'}
//                 </p>
//               </CardContent>
//             </Card>

//           </div>

//           {/* Main Charts Row */}
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">

//             <Card className="scada-panel flex flex-col h-full">
//               <CardHeader className="pb-0 pt-4 px-5">
//                 <CardTitle className="text-sm lcd-text text-white/80 flex justify-between">
//                   <span>Revenue Projection</span>
//                   <span className="text-primary font-mono">{formatCurrency(metrics.revenueMonth)}/mo</span>
//                 </CardTitle>
//               </CardHeader>
//               <CardContent className="flex-1 p-0 px-2 pb-2 mt-2">
//                 <ResponsiveContainer width="100%" height="100%">
//                   <AreaChart data={metrics.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                     <defs>
//                       <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
//                         <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
//                       </linearGradient>
//                     </defs>
//                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
//                     <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
//                     <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
//                     <RechartsTooltip
//                       contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(6, 182, 212, 0.3)', borderRadius: '4px' }}
//                       itemStyle={{ color: '#06b6d4' }}
//                       formatter={(value: number) => [formatCurrency(value), 'Revenue']}
//                     />
//                     <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
//                   </AreaChart>
//                 </ResponsiveContainer>
//               </CardContent>
//             </Card>

//             <Card className="scada-panel flex flex-col h-full">
//               <CardHeader className="pb-0 pt-4 px-5">
//                 <CardTitle className="text-sm lcd-text text-white/80 flex justify-between">
//                   <span>Demographic Distribution</span>
//                   <span className="text-muted-foreground font-mono text-xs">RAD: {radius}km</span>
//                 </CardTitle>
//               </CardHeader>
//               <CardContent className="flex-1 p-0 px-2 pb-4 mt-2">
//                 <ResponsiveContainer width="100%" height="100%">
//                   <BarChart data={metrics.ageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
//                     <XAxis dataKey="group" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
//                     <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} unit="%" />
//                     <RechartsTooltip
//                       contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}
//                       cursor={{ fill: 'rgba(255,255,255,0.05)' }}
//                       formatter={(value: number) => [`${value}%`, 'Share']}
//                     />
//                     <Bar dataKey="value" radius={[2, 2, 0, 0]}>
//                       {metrics.ageData.map((_entry, index) => (
//                         <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--accent))'} fillOpacity={0.8} />
//                       ))}
//                     </Bar>
//                   </BarChart>
//                 </ResponsiveContainer>
//               </CardContent>
//             </Card>

//           </div>

//           {/* Backend Monitor Cards Row */}
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//             {renderMonitorCard(backendData?.competition_monitor, <MapPin className="w-5 h-5" />)}
//             {renderMonitorCard(backendData?.revenue_monitor, <DollarSign className="w-5 h-5" />)}
//             {renderMonitorCard(backendData?.risk_monitor, <ShieldAlert className="w-5 h-5" />)}
//           </div>

//           {/* Bottom Summary Row */}
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

//             <Card className="scada-panel border-white/5 bg-background/50">
//               <CardContent className="p-5 flex items-center justify-between">
//                 <div>
//                   <p className="text-xs lcd-text text-muted-foreground mb-1">Financial Sustainability</p>
//                   <div className="flex items-baseline gap-2">
//                     <p className="text-2xl font-mono text-white">{metrics.sustainability.toFixed(0)}/100</p>
//                     <Badge variant="outline" className={`${metrics.sustainability > 70 ? 'text-emerald-400 border-emerald-400/30' : 'text-accent border-accent/30'}`}>
//                       {metrics.sustainability > 70 ? 'OPTIMAL' : 'WATCH'}
//                     </Badge>
//                   </div>
//                 </div>
//                 <div className="h-12 w-12 rounded-full border-4 border-white/10 flex items-center justify-center relative">
//                   <div
//                     className="absolute inset-0 rounded-full border-4 border-primary border-r-transparent border-t-transparent"
//                     style={{ transform: `rotate(${(metrics.sustainability / 100) * 360}deg)`, transition: 'transform 1s ease-out' }}
//                   ></div>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="scada-panel border-white/5 bg-background/50">
//               <CardContent className="p-5 flex items-center justify-between">
//                 <div>
//                   <p className="text-xs lcd-text text-muted-foreground mb-1">Crowding Levels</p>
//                   <div className="flex items-baseline gap-2">
//                     <p className="text-2xl font-mono text-white">{metrics.crowding}%</p>
//                     <span className="text-[10px] text-muted-foreground uppercase">Saturation</span>
//                   </div>
//                 </div>
//                 <div className="flex gap-1">
//                   {Array.from({ length: 10 }).map((_, i) => (
//                     <div
//                       key={i}
//                       className={`w-2 h-8 rounded-sm ${i < (metrics.crowding / 10) ? (i > 7 ? 'bg-destructive' : i > 5 ? 'bg-accent' : 'bg-primary') : 'bg-white/10'}`}
//                     ></div>
//                   ))}
//                 </div>
//               </CardContent>
//             </Card>

//           </div>

//         </div>
//       </div>
//     </div>
//   );
// }



import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart4,
  Cpu,
  Download,
  MapPin,
  Settings,
  Signal,
  Store,
  Target,
  TrendingUp,
  Users,
  AlertTriangle,
  DollarSign,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import {
  analyzeScenario,
  AVAILABLE_ZONES,
  BUSINESS_TYPE_MAP,
  fetchDashboardSummary,
  type DashboardSummaryResponse,
} from "@/services/api";

type BusinessKey = keyof typeof BUSINESS_TYPE_MAP;

const BUSINESS_OPTIONS: { key: BusinessKey; label: string }[] = [
  { key: "coffee", label: "Coffee Shop / Cafe" },
  { key: "fitness", label: "Fitness Center" },
  { key: "retail", label: "Retail Store" },
];

function indicatorLabelForCompetition(indicator: string) {
  switch (indicator) {
    case "green":
      return "LOW";
    case "yellow":
      return "MODERATE";
    case "red":
      return "HIGH";
    default:
      return "UNKNOWN";
  }
}

function indicatorLabelForRevenue(indicator: string) {
  switch (indicator) {
    case "green":
      return "STRONG";
    case "yellow":
      return "WATCH";
    case "red":
      return "WEAK";
    default:
      return "UNKNOWN";
  }
}

function indicatorLabelForRisk(indicator: string) {
  switch (indicator) {
    case "green":
      return "LOW";
    case "yellow":
      return "MEDIUM";
    case "red":
      return "HIGH";
    default:
      return "UNKNOWN";
  }
}

function indicatorTextClass(indicator: string) {
  switch (indicator) {
    case "green":
      return "text-emerald-400";
    case "yellow":
      return "text-accent";
    case "red":
      return "text-destructive";
    default:
      return "text-white";
  }
}

function indicatorBadgeClass(indicator: string) {
  switch (indicator) {
    case "green":
      return "text-emerald-400 border-emerald-400/30";
    case "yellow":
      return "text-accent border-accent/30";
    case "red":
      return "text-destructive border-destructive/30";
    default:
      return "text-white border-white/20";
  }
}

function buildAgeChartData(
  dashboardData: DashboardSummaryResponse | null
): { group: string; value: number }[] {
  if (!dashboardData) return [];

  const metrics = dashboardData.people_location_packet.metrics;
  const students = metrics.find((m) => m.key === "students_pct")?.value ?? 0;
  const families = metrics.find((m) => m.key === "families_pct")?.value ?? 0;
  const retirees = metrics.find((m) => m.key === "retirees_pct")?.value ?? 0;

  return [
    { group: "Students", value: students },
    { group: "Families", value: families },
    { group: "Retirees", value: retirees },
  ];
}

function buildPopulationTrend(population: number) {
  const safePopulation = Math.max(population, 1);

  return Array.from({ length: 12 }).map((_, i) => {
    const variance = (i % 2 === 0 ? 1 : -1) * safePopulation * 0.015;
    return {
      time: `${i * 2}h`,
      value: Math.round(safePopulation + variance),
    };
  });
}

function getPopulationMetric(data: DashboardSummaryResponse | null) {
  return (
    data?.people_location_packet.metrics.find((m) => m.key === "population_total")
      ?.value ?? 0
  );
}

function getStudentMetric(data: DashboardSummaryResponse | null) {
  return (
    data?.people_location_packet.metrics.find((m) => m.key === "students_pct")
      ?.value ?? 0
  );
}

function getFamiliesMetric(data: DashboardSummaryResponse | null) {
  return (
    data?.people_location_packet.metrics.find((m) => m.key === "families_pct")
      ?.value ?? 0
  );
}

function getRetireesMetric(data: DashboardSummaryResponse | null) {
  return (
    data?.people_location_packet.metrics.find((m) => m.key === "retirees_pct")
      ?.value ?? 0
  );
}

function businessKeyFromBackendLabel(label: string): BusinessKey {
  const match = Object.entries(BUSINESS_TYPE_MAP).find(
    ([, value]) => value.toLowerCase() === label.toLowerCase()
  );
  return (match?.[0] as BusinessKey) ?? "coffee";
}

export default function Dashboard() {
  const { toast } = useToast();

  const [radius, setRadius] = useState<number[]>([5]);
  const [businessType, setBusinessType] = useState<BusinessKey>("coffee");
  const [selectedZone, setSelectedZone] = useState<string>("Waterloo Region");

  const [dashboardData, setDashboardData] =
    useState<DashboardSummaryResponse | null>(null);

  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const hasInitializedRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const populationValue = getPopulationMetric(dashboardData);
  const studentPct = getStudentMetric(dashboardData);
  const familiesPct = getFamiliesMetric(dashboardData);
  const retireesPct = getRetireesMetric(dashboardData);

  const ageData = useMemo(() => buildAgeChartData(dashboardData), [dashboardData]);
  const populationTrend = useMemo(
    () => buildPopulationTrend(populationValue),
    [populationValue]
  );

  useEffect(() => {
    async function loadInitialDashboard() {
      try {
        setIsInitialLoading(true);
        const data = await fetchDashboardSummary();
        setDashboardData(data);
        setSelectedZone(data.selected_zone);
        setBusinessType(businessKeyFromBackendLabel(data.selected_business_type));
        setRadius([data.radius_km]);
        setLastUpdate(new Date());
        hasInitializedRef.current = true;
      } catch (error) {
        toast({
          title: "Failed to load dashboard",
          description:
            error instanceof Error
              ? error.message
              : "Unable to retrieve initial dashboard data.",
          variant: "destructive",
        });
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadInitialDashboard();
  }, [toast]);

  useEffect(() => {
    if (!hasInitializedRef.current) return;

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      try {
        setIsUpdating(true);

        const response = await analyzeScenario({
          selected_zone: selectedZone,
          selected_business_type: BUSINESS_TYPE_MAP[businessType],
          radius_km: radius[0],
        });

        setDashboardData(response);
        setLastUpdate(new Date());
      } catch (error) {
        toast({
          title: "Scenario analysis failed",
          description:
            error instanceof Error
              ? error.message
              : "Could not update dashboard from backend.",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [selectedZone, businessType, radius, toast]);

  const handleExport = () => {
    toast({
      title: "Export not available yet",
      description:
        "PDF export is not connected in the backend yet. The UI button is kept for design continuity.",
      duration: 3000,
    });
  };

  if (isInitialLoading || !dashboardData) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="scada-panel px-6 py-4 rounded-lg">
          <p className="lcd-text text-sm text-white/80">Loading Zonalyze core...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans p-4 lg:p-6 overflow-x-hidden">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-4 border-b border-white/10 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-md flex items-center justify-center border border-primary/50 relative overflow-hidden">
            <Activity className="text-primary w-6 h-6 z-10" />
            <div className="absolute inset-0 bg-primary/20 animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-wider text-white">
              ZONALYZE{" "}
              <span className="text-primary text-sm tracking-widest uppercase">
                Sys.Core
              </span>
            </h1>
            <p className="text-muted-foreground text-xs lcd-text">
              Simulated Environment Monitor v1.0.4
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 md:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Link
            href="/"
            className="text-[10px] lcd-text px-3 py-1.5 rounded border transition-all uppercase tracking-widest inline-block bg-primary/20 border-primary/50 text-primary"
          >
            Core
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-card/40 px-3 py-1.5 rounded-md border border-white/5 backdrop-blur-md">
            <Signal
              className={`w-4 h-4 ${
                isUpdating ? "text-accent animate-pulse" : "text-emerald-400"
              }`}
            />
            <span className="text-xs lcd-text text-white/80">
              LIVE SYNC: {isUpdating ? "CALCULATING..." : lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <Button
            variant="outline"
            className="bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary-foreground font-mono text-sm uppercase tracking-wider"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display text-white/90">Control Dials</h2>
          </div>

          <Card className="scada-panel border-white/5">
            <CardContent className="p-5 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
                    <Target className="w-3 h-3" /> Search Radius
                  </label>
                  <span className="text-primary font-mono text-sm font-bold">
                    {radius[0]} km
                  </span>
                </div>
                <Slider
                  value={radius}
                  onValueChange={setRadius}
                  max={20}
                  min={1}
                  step={1}
                  className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Zone
                </label>
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                  <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    {AVAILABLE_ZONES.map((zone) => (
                      <SelectItem key={zone} value={zone} className="font-mono text-sm">
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
                  <Store className="w-3 h-3" /> Venture Type
                </label>
                <Select value={businessType} onValueChange={(v) => setBusinessType(v as BusinessKey)}>
                  <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    {BUSINESS_OPTIONS.map((option) => (
                      <SelectItem key={option.key} value={option.key} className="font-mono text-sm">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="scada-panel p-4 rounded-lg mt-auto">
            <div className="flex items-center gap-3">
              <Cpu className="w-8 h-8 text-primary/50 animate-pulse" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Processing Node
                </p>
                <p className="text-sm font-mono text-primary">ZN-CORE-ACTIVE</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 flex flex-col gap-6">
          <div className="flex items-center gap-2 mb-[-8px]">
            <BarChart4 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display text-white/90">Environment Sensors</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="scada-panel relative group">
              <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 rounded-bl-xl border-b border-l border-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <CardContent className="p-5">
                <p className="text-xs lcd-text text-muted-foreground mb-1">
                  Total Population
                </p>
                <p className="text-3xl data-value">
                  {populationValue.toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Live people/location packet
                </p>
              </CardContent>
            </Card>

            <Card className="scada-panel relative">
              <div className="absolute top-0 right-0 w-8 h-8 bg-accent/10 rounded-bl-xl border-b border-l border-accent/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-accent" />
              </div>
              <CardContent className="p-5">
                <p className="text-xs lcd-text text-muted-foreground mb-1">
                  Competition Status
                </p>
                <p className={`text-3xl font-mono ${indicatorTextClass(dashboardData.competition_monitor.indicator)}`}>
                  {indicatorLabelForCompetition(dashboardData.competition_monitor.indicator)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {dashboardData.competition_monitor.value}
                </p>
              </CardContent>
            </Card>

            <Card className="scada-panel relative">
              <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 rounded-bl-xl border-b border-l border-primary/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <CardContent className="p-5">
                <p className="text-xs lcd-text text-muted-foreground mb-1">
                  Revenue Outlook
                </p>
                <p className={`text-3xl font-mono ${indicatorTextClass(dashboardData.revenue_monitor.indicator)}`}>
                  {indicatorLabelForRevenue(dashboardData.revenue_monitor.indicator)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {dashboardData.revenue_monitor.value}
                </p>
              </CardContent>
            </Card>

            <Card className="scada-panel relative overflow-hidden">
              <div className="absolute top-0 right-0 w-8 h-8 bg-destructive/10 rounded-bl-xl border-b border-l border-destructive/20 flex items-center justify-center z-10">
                <AlertTriangle className={`w-4 h-4 ${indicatorTextClass(dashboardData.risk_monitor.indicator)}`} />
              </div>
              <CardContent className="p-5 relative z-10">
                <p className="text-xs lcd-text text-muted-foreground mb-1">
                  Investment Risk Level
                </p>
                <p className={`text-3xl font-mono ${indicatorTextClass(dashboardData.risk_monitor.indicator)}`}>
                  {indicatorLabelForRisk(dashboardData.risk_monitor.indicator)}
                </p>
                <p className="text-[10px] text-white/60 mt-2 uppercase tracking-widest">
                  {dashboardData.risk_monitor.value}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">
            <Card className="scada-panel flex flex-col h-full">
              <CardHeader className="pb-0 pt-4 px-5">
                <CardTitle className="text-sm lcd-text text-white/80 flex justify-between">
                  <span>Population Coverage Trend</span>
                  <span className="text-primary font-mono">
                    {populationValue.toLocaleString()} people
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 px-2 pb-2 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={populationTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(6, 182, 212, 0.3)",
                        borderRadius: "4px",
                      }}
                      itemStyle={{ color: "#06b6d4" }}
                      formatter={(value: number) => [`${value.toLocaleString()} people`, "Population"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorPop)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="scada-panel flex flex-col h-full">
              <CardHeader className="pb-0 pt-4 px-5">
                <CardTitle className="text-sm lcd-text text-white/80 flex justify-between">
                  <span>Demographic Distribution</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    RAD: {radius[0]} km
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 px-2 pb-4 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="group" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "4px",
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      formatter={(value: number) => [`${value}%`, "Share"]}
                    />
                    <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                      {ageData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="scada-panel border-white/5 bg-background/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs lcd-text text-muted-foreground mb-1">
                    People & Location Summary
                  </p>
                  <p className="text-sm text-white/80 max-w-[420px]">
                    {dashboardData.people_location_packet.summary_text}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className={indicatorBadgeClass(dashboardData.people_location_packet.indicator)}>
                      {dashboardData.people_location_packet.indicator.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-primary border-primary/30">
                      Zone: {dashboardData.selected_zone}
                    </Badge>
                    <Badge variant="outline" className="text-white/80 border-white/20">
                      Type: {dashboardData.selected_business_type}
                    </Badge>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full border-4 border-white/10 flex items-center justify-center relative">
                  <div
                    className="absolute inset-0 rounded-full border-4 border-primary border-r-transparent border-t-transparent"
                    style={{
                      transform: `rotate(${(studentPct / 100) * 360}deg)`,
                      transition: "transform 1s ease-out",
                    }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="scada-panel border-white/5 bg-background/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs lcd-text text-muted-foreground mb-1">
                    Packet Breakdown
                  </p>
                  <div className="flex items-baseline gap-4 flex-wrap">
                    <p className="text-sm font-mono text-white">Students: {studentPct}%</p>
                    <p className="text-sm font-mono text-white">Families: {familiesPct}%</p>
                    <p className="text-sm font-mono text-white">Retirees: {retireesPct}%</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase mt-2">
                    Source: {dashboardData.people_location_packet.meta.data_source || "unknown"} • Status:{" "}
                    {dashboardData.people_location_packet.meta.status || "unknown"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {[studentPct, familiesPct, retireesPct].map((value, i) => (
                    <div
                      key={i}
                      className={`w-3 rounded-sm ${
                        i === 0 ? "bg-primary" : i === 1 ? "bg-accent" : "bg-emerald-400"
                      }`}
                      style={{ height: `${Math.max(16, value)}px` }}
                    ></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}