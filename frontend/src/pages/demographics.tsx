import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, TrendingUp, MapPin, Search, 
  Filter, Layers, ArrowRight, MousePointer2 
} from 'lucide-react';

const mockSegments = [
  { id: 1, name: "Young Professionals", size: "28%", growth: "+4.2%", affinity: "High" },
  { id: 2, name: "Family Households", size: "35%", growth: "-1.1%", affinity: "Medium" },
  { id: 3, name: "Retirees", size: "15%", growth: "+0.8%", affinity: "Low" },
  { id: 4, name: "Students", size: "22%", growth: "+12.4%", affinity: "Very High" },
];

export default function Demographics() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-display font-bold tracking-wider text-white">DEMOGRAPHIC <span className="text-primary">ANALYTICS</span></h1>
        <p className="text-muted-foreground text-xs lcd-text">Population Intelligence & Segmentation</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="scada-panel">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <Users className="w-8 h-8 text-primary opacity-50" />
              <Badge variant="outline" className="border-primary/30 text-primary">Live</Badge>
            </div>
            <h3 className="text-sm lcd-text text-muted-foreground">Total Catchment</h3>
            <p className="text-4xl data-value">128,402</p>
          </CardContent>
        </Card>
        
        <Card className="scada-panel">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <TrendingUp className="w-8 h-8 text-accent opacity-50" />
              <Badge variant="outline" className="border-accent/30 text-accent">+12%</Badge>
            </div>
            <h3 className="text-sm lcd-text text-muted-foreground">Growth Projection</h3>
            <p className="text-4xl data-value-accent">High</p>
          </CardContent>
        </Card>

        <Card className="scada-panel">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <MapPin className="w-8 h-8 text-emerald-500 opacity-50" />
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">Core</Badge>
            </div>
            <h3 className="text-sm lcd-text text-muted-foreground">Density Index</h3>
            <p className="text-4xl data-value text-emerald-400">9.2</p>
          </CardContent>
        </Card>
      </div>

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
              {mockSegments.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5 hover:border-primary/30 transition-colors">
                  <div>
                    <p className="font-mono text-white">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Market Size: {s.size}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono ${s.growth.startsWith('+') ? 'text-emerald-400' : 'text-destructive'}`}>{s.growth}</p>
                    <Badge variant="secondary" className="text-[10px] h-4">{s.affinity} Affinity</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="scada-panel flex items-center justify-center min-h-[300px] border-dashed border-white/10">
          <div className="text-center p-8">
            <MousePointer2 className="w-12 h-12 text-primary/20 mx-auto mb-4 animate-bounce" />
            <p className="text-muted-foreground lcd-text uppercase tracking-widest text-sm">Interactive Map Engine</p>
            <p className="text-[10px] text-muted-foreground mt-2 max-w-[200px]">Layer selection required to initialize spatial visualization</p>
            <div className="flex gap-2 mt-4 justify-center">
              <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase border-primary/20">Income Heatmap</Button>
              <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase border-primary/20">Age Clusters</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}