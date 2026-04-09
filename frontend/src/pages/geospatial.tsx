import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Globe, Radio, Layers, Map, 
  Box, MousePointer2, Settings2, Share2, Activity
} from 'lucide-react';

export default function Geospatial() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <header className="mb-8 border-b border-white/10 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-white">SPATIAL <span className="text-primary">MAPPING</span></h1>
          <p className="text-muted-foreground text-xs lcd-text">Geographic Intelligence System (GIS)</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">GPS: ACTIVE</Badge>
           <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20">SAT: LINKED</Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="scada-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lcd-text text-white/70 uppercase">Layer Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { id: 'pop', label: 'Population Heat', icon: Globe, active: true },
                { id: 'comp', label: 'Competitor Nodes', icon: Radio, active: true },
                { id: 'traf', label: 'Traffic Density', icon: Activity, active: false },
                { id: 'util', label: 'Infrastructure', icon: Layers, active: false },
              ].map(layer => (
                <button 
                  key={layer.id}
                  className={`w-full flex items-center justify-between p-3 rounded border transition-all ${layer.active ? 'bg-primary/10 border-primary/30 text-white' : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-3">
                    <layer.icon className="w-4 h-4" />
                    <span className="text-sm font-mono">{layer.label}</span>
                  </div>
                  {layer.active && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="scada-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs lcd-text text-white/70 uppercase">Viewport Controls</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
               <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">Zoom In</button>
               <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">Zoom Out</button>
               <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">Center</button>
               <button className="p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 text-[10px] font-mono uppercase">3D Mode</button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
           <Card className="scada-panel h-[600px] flex items-center justify-center relative bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center grayscale opacity-40 brightness-50">
             <div className="absolute inset-0 bg-primary/10 mix-blend-overlay"></div>
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-black/60 backdrop-blur-sm">
                <div className="relative mb-6">
                  <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                  <Globe className="w-16 h-16 text-primary relative z-10" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white mb-2">SPATIAL RENDERER</h2>
                <p className="text-muted-foreground lcd-text text-sm mb-6 max-w-md">Initializing high-fidelity geographic simulation. This environment uses real-time vector tiles and demographic overlays.</p>
                <div className="flex gap-4">
                  <Button className="font-mono h-10 px-6 uppercase tracking-widest bg-primary hover:bg-primary/80">Launch Viewer</Button>
                  <Button variant="outline" className="font-mono h-10 px-6 uppercase tracking-widest border-white/20">Calibrate Sensors</Button>
                </div>
             </div>
             {/* Decorative HUD elements */}
             <div className="absolute top-4 right-4 p-2 bg-black/80 border border-white/10 rounded font-mono text-[10px] text-primary space-y-1">
                <p>LAT: 40.7128° N</p>
                <p>LNG: 74.0060° W</p>
                <p>ALT: 2,402m</p>
             </div>
           </Card>
        </div>
      </div>
    </div>
  );
}