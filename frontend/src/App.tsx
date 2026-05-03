// import { Switch, Route } from "wouter";
// import { queryClient } from "./lib/queryClient";
// import { QueryClientProvider } from "@tanstack/react-query";
// import { Toaster } from "@/components/ui/toaster";
// import { TooltipProvider } from "@/components/ui/tooltip";
// import NotFound from "@/pages/not-found";
// import Dashboard from "@/pages/dashboard";
// import Demographics from "@/pages/demographics";
// import Risk from "@/pages/risk";
// import BusinessCase from "@/pages/business-case";
// import Geospatial from "@/pages/geospatial";

// function Router() {
//   return (
//     <Switch>
//       <Route path="/" component={Dashboard}/>
//       <Route path="/demographics" component={Demographics}/>
//       <Route path="/risk" component={Risk}/>
//       <Route path="/business-case" component={BusinessCase}/>
//       <Route path="/geospatial" component={Geospatial}/>
//       <Route component={NotFound} />
//     </Switch>
//   );
// }

// function App() {
//   return (
//     <QueryClientProvider client={queryClient}>
//       <TooltipProvider>
//         <div className="scanline" />
//         <Toaster />
//         <Router />
//       </TooltipProvider>
//     </QueryClientProvider>
//   );
// }

// export default App;





import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="scanline" />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;