import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Briefcase, BarChart3, PieChart, TrendingUp, 
  ArrowUpRight, ArrowDownRight, DollarSign, Target
} from 'lucide-react';

const projections = [
  { month: "M1", rev: "$42k", cost: "$28k", margin: "33%" },
  { month: "M2", rev: "$45k", cost: "$28k", margin: "37%" },
  { month: "M3", rev: "$52k", cost: "$29k", margin: "44%" },
  { month: "M4", rev: "$58k", cost: "$30k", margin: "48%" },
];

export default function BusinessCase() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-display font-bold tracking-wider text-white">BUSINESS <span className="text-accent">MODELER</span></h1>
        <p className="text-muted-foreground text-xs lcd-text">Financial Forecasting & Viability Matrix</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Est. Breakeven", val: "14 Mo", icon: Target, color: "text-primary" },
          { label: "Avg. Transaction", val: "$18.50", icon: DollarSign, color: "text-accent" },
          { label: "ROI Projection", val: "22.4%", icon: TrendingUp, color: "text-emerald-400" },
          { label: "Market Share", val: "4.2%", icon: Briefcase, color: "text-primary" },
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
              <Badge variant="outline" className="text-[10px] border-accent/20 text-accent">Simulated</Badge>
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