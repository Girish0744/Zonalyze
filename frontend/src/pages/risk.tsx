import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, Crosshair, Zap, Activity, 
  AlertTriangle, ShieldCheck, Search, Info
} from 'lucide-react';

export default function Risk() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-white">RISK <span className="text-destructive">ASSESSMENT</span></h1>
          <p className="text-muted-foreground text-xs lcd-text">Threat Vectors & Investment Security</p>
        </div>
        <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">Critical Monitoring On</Badge>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="scada-panel border-destructive/20">
            <CardContent className="p-6 text-center">
              <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-2" />
              <p className="text-xs lcd-text text-muted-foreground">Composite Risk Index</p>
              <p className="text-5xl data-value-destructive">68.4</p>
              <div className="mt-4 p-2 bg-destructive/10 rounded border border-destructive/20">
                <p className="text-[10px] text-destructive font-bold uppercase italic">Action Required</p>
              </div>
            </CardContent>
          </Card>

          <Card className="scada-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lcd-text text-white/70">Risk Vectors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Market Saturation", val: 82 },
                { label: "Op-Cost Volatility", val: 45 },
                { label: "Competitor Agility", val: 74 },
                { label: "Regulatory Flux", val: 29 },
              ].map(v => (
                <div key={v.label} className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-mono">
                    <span className="text-muted-foreground">{v.label}</span>
                    <span className={v.val > 70 ? 'text-destructive' : 'text-primary'}>{v.val}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${v.val > 70 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${v.val}%` }} />
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
                Live Incident Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: "14:22:01", msg: "New competitor entity detected in sector 4-G", type: "warning", icon: AlertTriangle },
                  { time: "13:45:12", msg: "Commercial real-estate price spike (+14%)", type: "critical", icon: ShieldAlert },
                  { time: "11:30:45", msg: "Standard utility cost updated to current market", type: "info", icon: Info },
                  { time: "09:12:33", msg: "Zone-B demand levels exceeded projections", type: "success", icon: ShieldCheck },
                ].map((log, i) => (
                  <div key={i} className="flex gap-4 p-3 bg-white/5 rounded border border-white/5 font-mono text-sm group hover:bg-white/10 transition-colors">
                    <span className="text-muted-foreground shrink-0">{log.time}</span>
                    <log.icon className={`w-4 h-4 shrink-0 mt-0.5 ${log.type === 'critical' ? 'text-destructive' : log.type === 'warning' ? 'text-accent' : 'text-primary'}`} />
                    <span className="text-white/80">{log.msg}</span>
                    <Button variant="ghost" size="icon" className="ml-auto h-5 w-5 opacity-0 group-hover:opacity-100"><Search className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}