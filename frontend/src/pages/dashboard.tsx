// frontend/src/pages/dashboard.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart4,
  BrainCircuit,
  Cpu,
  Database,
  DollarSign,
  Download,
  MapPin,
  Settings,
  Signal,
  ShieldCheck,
  Store,
  Target,
  TrendingUp,
  Users,
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

import {
  analyzeScenario,
  fetchBusinessSubcategories,
  fetchDashboardSummary,
  fetchMunicipalities,
  fetchModelStatus,
  generateFeasibilityReport,
  runSystemValidation,
  type BusinessSubcategoryOption,
  type DashboardSummaryResponse,
  type MunicipalityOption,
  type ModelStatusResponse,
  type SystemValidationResponse,
} from "@/services/api";

const DEFAULT_MUNICIPALITY = "Kitchener";
const DEFAULT_BUSINESS = "Indian Grocery Store";
const DEFAULT_RADIUS = 5;

function indicatorLabelForCompetition(indicator: string) {
  if (indicator === "green") return "LOW";
  if (indicator === "yellow") return "MODERATE";
  if (indicator === "red") return "HIGH";
  return "UNKNOWN";
}

function indicatorLabelForRevenue(indicator: string) {
  if (indicator === "green") return "POSITIVE";
  if (indicator === "yellow") return "WATCH";
  if (indicator === "red") return "NEGATIVE";
  return "UNKNOWN";
}

function indicatorLabelForRisk(indicator: string) {
  if (indicator === "green") return "LOW";
  if (indicator === "yellow") return "MEDIUM";
  if (indicator === "red") return "HIGH";
  return "UNKNOWN";
}

function indicatorTextClass(indicator: string) {
  if (indicator === "green") return "text-emerald-400";
  if (indicator === "yellow") return "text-accent";
  if (indicator === "red") return "text-destructive";
  return "text-white";
}

function indicatorBadgeClass(indicator: string) {
  if (indicator === "green") return "text-emerald-400 border-emerald-400/30";
  if (indicator === "yellow") return "text-accent border-accent/30";
  if (indicator === "red") return "text-destructive border-destructive/30";
  return "text-white border-white/20";
}

function recommendationBadgeClass(recommendation?: string) {
  if (recommendation === "recommended")
    return "text-emerald-400 border-emerald-400/30";
  if (recommendation === "borderline") return "text-accent border-accent/30";
  if (recommendation === "not_recommended")
    return "text-destructive border-destructive/30";
  return "text-white border-white/20";
}

function getMetric(data: DashboardSummaryResponse | null, key: string) {
  return (
    data?.people_location_packet.metrics.find((m) => m.key === key)?.value ?? 0
  );
}

function buildDemographicChartData(data: DashboardSummaryResponse | null) {
  return [
    { group: "Youth", value: getMetric(data, "students_pct") },
    { group: "Families", value: getMetric(data, "families_pct") },
    { group: "Seniors", value: getMetric(data, "retirees_pct") },
    { group: "Diversity", value: getMetric(data, "diversity_index_0_100") },
  ].filter((item) => Number.isFinite(item.value));
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

function buildRiskProbabilityData(data: DashboardSummaryResponse | null) {
  const probs = data?.ml_prediction?.risk_probabilities ?? {};

  return Object.entries(probs).map(([riskClass, probability]) => ({
    riskClass: riskClass.toUpperCase(),
    probability: Math.round(probability * 100),
  }));
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function readableRecommendation(value?: string) {
  if (!value) return "No recommendation";
  return value.replace(/_/g, " ").toUpperCase();
}

export default function Dashboard() {
  const { toast } = useToast();

  const [radius, setRadius] = useState<number[]>([DEFAULT_RADIUS]);
  const [municipalityName, setMunicipalityName] =
    useState(DEFAULT_MUNICIPALITY);
  const [businessSubcategory, setBusinessSubcategory] =
    useState(DEFAULT_BUSINESS);

  const [municipalityOptions, setMunicipalityOptions] = useState<
    MunicipalityOption[]
  >([]);
  const [businessOptions, setBusinessOptions] = useState<
    BusinessSubcategoryOption[]
  >([]);
  const [dashboardData, setDashboardData] =
    useState<DashboardSummaryResponse | null>(null);

  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [systemValidation, setSystemValidation] =
    useState<SystemValidationResponse | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const debounceRef = useRef<number | null>(null);
  const initialLoadDoneRef = useRef(false);

  const ml = dashboardData?.ml_prediction ?? null;
  const explanation = dashboardData?.prediction_explanation ?? null;
  const breakdown = dashboardData?.analysis_breakdown ?? null;
  const populationValue = getMetric(dashboardData, "population_total");
  const studentPct = getMetric(dashboardData, "students_pct");
  const familiesPct = getMetric(dashboardData, "families_pct");
  const retireesPct = getMetric(dashboardData, "retirees_pct");
  const density = getMetric(dashboardData, "population_density_per_km2");
  const medianIncome = getMetric(
    dashboardData,
    "household_median_total_income_2020",
  );

  const demographicChartData = useMemo(
    () => buildDemographicChartData(dashboardData),
    [dashboardData],
  );
  const populationTrend = useMemo(
    () => buildPopulationTrend(populationValue),
    [populationValue],
  );
  const riskProbabilityData = useMemo(
    () => buildRiskProbabilityData(dashboardData),
    [dashboardData],
  );

  useEffect(() => {
    async function loadStartupData() {
      try {
        setIsInitialLoading(true);

        const [municipalitiesData, businessData, modelStatusData] = await Promise.all([
          fetchMunicipalities(),
          fetchBusinessSubcategories(),
          fetchModelStatus().catch(() => null),
        ]);

        setMunicipalityOptions(municipalitiesData.municipalities);
        setBusinessOptions(businessData.business_subcategories);
        setModelStatus(modelStatusData);

        let firstDashboard: DashboardSummaryResponse;
        try {
          firstDashboard = await fetchDashboardSummary();
        } catch {
          firstDashboard = await analyzeScenario({
            municipality_name: DEFAULT_MUNICIPALITY,
            business_subcategory: DEFAULT_BUSINESS,
            radius_km: DEFAULT_RADIUS,
          });
        }

        setDashboardData(firstDashboard);
        setMunicipalityName(
          firstDashboard.municipality_name || DEFAULT_MUNICIPALITY,
        );
        setBusinessSubcategory(
          firstDashboard.business_subcategory || DEFAULT_BUSINESS,
        );
        setRadius([firstDashboard.radius_km || DEFAULT_RADIUS]);
        setLastUpdate(new Date());
        initialLoadDoneRef.current = true;
      } catch (error) {
        toast({
          title: "Dashboard loading failed",
          description:
            error instanceof Error
              ? error.message
              : "Could not load the dashboard data from the backend.",
          variant: "destructive",
        });
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadStartupData();
  }, [toast]);

  useEffect(() => {
    if (!initialLoadDoneRef.current) return;

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      try {
        setIsUpdating(true);

        const response = await analyzeScenario({
          municipality_name: municipalityName,
          business_subcategory: businessSubcategory,
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
              : "Could not update the dashboard from the backend.",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [municipalityName, businessSubcategory, radius, toast]);

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const report = await generateFeasibilityReport({
        municipality_name: municipalityName,
        business_subcategory: businessSubcategory,
        radius_km: radius[0],
      });

      const blob = new Blob([report.report_text], {
        type: report.content_type || "text/plain",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = report.filename || "zonalyze-feasibility-report.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Report exported",
        description:
          "The feasibility report was generated from the latest backend scenario.",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Report export failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not generate the feasibility report.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRunValidation = async () => {
    try {
      setIsValidating(true);
      const validation = await runSystemValidation();
      setSystemValidation(validation);

      toast({
        title:
          validation.overall_status === "passed"
            ? "System validation passed"
            : "System validation found issues",
        description: `${validation.passed_checks}/${validation.total_checks} validation checks passed.`,
        variant:
          validation.overall_status === "passed" ? "default" : "destructive",
        duration: 3500,
      });
    } catch (error) {
      toast({
        title: "System validation failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not run the backend validation check.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  if (isInitialLoading || !dashboardData) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="scada-panel px-6 py-4 rounded-lg">
          <p className="lcd-text text-sm text-white/80">
            Loading Zonalyze ML core...
          </p>
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
            <div className="absolute inset-0 bg-primary/20 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-wider text-white">
              ZONALYZE{" "}
              <span className="text-primary text-sm tracking-widest uppercase">
                ML.Core
              </span>
            </h1>
            <p className="text-muted-foreground text-xs lcd-text">
              {dashboardData.project_phase}
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
              className={`w-4 h-4 ${isUpdating ? "text-accent animate-pulse" : "text-emerald-400"}`}
            />
            <span className="text-xs lcd-text text-white/80">
              LIVE SYNC:{" "}
              {isUpdating ? "CALCULATING..." : lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <Button
            variant="outline"
            className="bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary-foreground font-mono text-sm uppercase tracking-wider"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download
              className={`w-4 h-4 mr-2 ${isExporting ? "animate-pulse" : ""}`}
            />
            {isExporting ? "Generating..." : "Export Report"}
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display text-white/90">
              Control Dials
            </h2>
          </div>

          <Card className="scada-panel border-white/5">
            <CardContent className="p-5 space-y-6">
              <div className="space-y-3">
                <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Municipality
                </label>
                <Select
                  value={municipalityName}
                  onValueChange={setMunicipalityName}
                >
                  <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
                    <SelectValue placeholder="Select municipality" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10 max-h-[320px]">
                    {municipalityOptions.map((city) => (
                      <SelectItem
                        key={`${city.municipality_name}-${city.municipality_type}`}
                        value={city.municipality_name}
                        className="font-mono text-sm"
                      >
                        {city.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-xs lcd-text text-muted-foreground flex items-center gap-1">
                  <Store className="w-3 h-3" /> Business Subcategory
                </label>
                <Select
                  value={businessSubcategory}
                  onValueChange={setBusinessSubcategory}
                >
                  <SelectTrigger className="bg-background/50 border-white/10 font-mono text-sm h-9">
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10 max-h-[320px]">
                    {businessOptions.map((business) => (
                      <SelectItem
                        key={`${business.business_category}-${business.business_subcategory}`}
                        value={business.business_subcategory}
                        className="font-mono text-sm"
                      >
                        {business.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  max={25}
                  min={1}
                  step={1}
                  className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                />
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
                <p className="text-sm font-mono text-primary">ZN-ML-ACTIVE</p>
              </div>
            </div>
          </div>

          <Card className="scada-panel border-white/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BrainCircuit
                  className={`w-5 h-5 ${modelStatus?.status === "ready" ? "text-primary" : "text-accent"}`}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    ML Model Status
                  </p>
                  <p className="text-xs font-mono text-white/80 uppercase">
                    {modelStatus?.status ?? "unknown"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Rows</p>
                  <p className="text-xs font-mono text-white">
                    {modelStatus ? formatNumber(modelStatus.row_count) : "N/A"}
                  </p>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Features</p>
                  <p className="text-xs font-mono text-white">
                    {modelStatus?.feature_count ?? "N/A"}
                  </p>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Risk Acc.</p>
                  <p className="text-xs font-mono text-primary">
                    {formatPercent(modelStatus?.risk_accuracy)}
                  </p>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">Revenue R²</p>
                  <p className="text-xs font-mono text-primary">
                    {modelStatus?.revenue_r2?.toFixed(3) ?? "N/A"}
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-white/50 leading-relaxed">
                {modelStatus?.important_note ??
                  "Model metadata is not available yet."}
              </p>
            </CardContent>
          </Card>

          <Card className="scada-panel border-white/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className={`w-5 h-5 ${systemValidation?.overall_status === "failed" ? "text-destructive" : "text-emerald-400"}`}
                  />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      System Validation
                    </p>
                    <p className="text-xs font-mono text-white/80">
                      {systemValidation
                        ? `${systemValidation.passed_checks}/${systemValidation.total_checks} checks passed`
                        : "Not checked yet"}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full bg-emerald-400/10 hover:bg-emerald-400/20 border-emerald-400/30 text-emerald-100 font-mono text-xs uppercase tracking-wider"
                onClick={handleRunValidation}
                disabled={isValidating}
              >
                <ShieldCheck
                  className={`w-4 h-4 mr-2 ${isValidating ? "animate-pulse" : ""}`}
                />
                {isValidating ? "Running..." : "Run Validation"}
              </Button>

              {systemValidation && (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {systemValidation.checks.map((check) => (
                    <p
                      key={check.name}
                      className={`text-[10px] font-mono ${check.status === "passed" ? "text-emerald-300" : "text-destructive"}`}
                    >
                      {check.status === "passed" ? "PASS" : "FAIL"}:{" "}
                      {check.name}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-9 flex flex-col gap-6">
          <div className="flex items-center gap-2 mb-[-8px]">
            <BarChart4 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-display text-white/90">
              Environment Sensors
            </h2>
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
                  {formatNumber(populationValue)}
                </p>
                <p className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />{" "}
                  {dashboardData.municipality_name}
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
                <p
                  className={`text-3xl font-mono ${indicatorTextClass(dashboardData.competition_monitor.indicator)}`}
                >
                  {indicatorLabelForCompetition(
                    dashboardData.competition_monitor.indicator,
                  )}
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
                  Monthly Net Revenue
                </p>
                <p
                  className={`text-2xl font-mono ${indicatorTextClass(dashboardData.revenue_monitor.indicator)}`}
                >
                  {formatCurrency(ml?.predicted_monthly_net_revenue)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {indicatorLabelForRevenue(
                    dashboardData.revenue_monitor.indicator,
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="scada-panel relative overflow-hidden">
              <div className="absolute top-0 right-0 w-8 h-8 bg-destructive/10 rounded-bl-xl border-b border-l border-destructive/20 flex items-center justify-center z-10">
                <AlertTriangle
                  className={`w-4 h-4 ${indicatorTextClass(dashboardData.risk_monitor.indicator)}`}
                />
              </div>
              <CardContent className="p-5 relative z-10">
                <p className="text-xs lcd-text text-muted-foreground mb-1">
                  Investment Risk
                </p>
                <p
                  className={`text-3xl font-mono ${indicatorTextClass(dashboardData.risk_monitor.indicator)}`}
                >
                  {ml?.predicted_risk_class?.toUpperCase() ??
                    indicatorLabelForRisk(dashboardData.risk_monitor.indicator)}
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
                    {formatNumber(populationValue)} people
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 px-2 pb-2 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={populationTrend}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) =>
                        `${Math.round(Number(val) / 1000)}k`
                      }
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(6, 182, 212, 0.3)",
                        borderRadius: "4px",
                      }}
                      itemStyle={{ color: "#06b6d4" }}
                      formatter={(value: number) => [
                        `${value.toLocaleString()} people`,
                        "Population",
                      ]}
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
                    RAD: {radius[0]}km
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 px-2 pb-4 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={demographicChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="group"
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.2)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "4px",
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      formatter={(value: number) => [`${value}%`, "Value"]}
                    />
                    <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                      {demographicChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            index % 2 === 0
                              ? "hsl(var(--primary))"
                              : "hsl(var(--accent))"
                          }
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="scada-panel border-white/5 bg-background/50 md:col-span-2">
              <CardContent className="p-5">
                <p className="text-xs lcd-text text-muted-foreground mb-1">
                  ML Prediction Summary
                </p>
                <p className="text-sm text-white/80 max-w-[680px]">
                  {dashboardData.people_location_packet.summary_text}
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge
                    variant="outline"
                    className={indicatorBadgeClass(
                      dashboardData.people_location_packet.indicator,
                    )}
                  >
                    {dashboardData.people_location_packet.indicator.toUpperCase()}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-primary border-primary/30"
                  >
                    City: {dashboardData.municipality_name}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-white/80 border-white/20"
                  >
                    Type: {dashboardData.business_subcategory}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={recommendationBadgeClass(ml?.recommendation)}
                  >
                    {readableRecommendation(ml?.recommendation)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Feasibility
                    </p>
                    <p className="text-lg font-mono text-primary">
                      {ml?.predicted_feasibility_score?.toFixed(1) ?? "N/A"}/100
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Density
                    </p>
                    <p className="text-lg font-mono text-white">
                      {density ? formatNumber(density) : "N/A"}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Median Income
                    </p>
                    <p className="text-lg font-mono text-white">
                      {medianIncome ? formatCurrency(medianIncome) : "N/A"}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Competition
                    </p>
                    <p className="text-lg font-mono text-white">
                      {explanation?.competition_score?.toFixed(1) ?? "N/A"}/100
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Demand
                    </p>
                    <p className="text-lg font-mono text-white">
                      {explanation?.demand_score?.toFixed(1) ?? "N/A"}/100
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Lease Estimate
                    </p>
                    <p className="text-lg font-mono text-white">
                      {formatCurrency(explanation?.monthly_lease_cost_estimate)}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Data Source
                    </p>
                    <p className="text-lg font-mono text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" />
                      {dashboardData.people_location_packet.meta.data_source ||
                        "API"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="scada-panel border-white/5 bg-background/50">
              <CardContent className="p-5">
                <p className="text-xs lcd-text text-muted-foreground mb-3">
                  Risk Probability
                </p>
                <div className="space-y-3">
                  {riskProbabilityData.map((item) => (
                    <div key={item.riskClass}>
                      <div className="flex justify-between text-xs font-mono text-white/80 mb-1">
                        <span>{item.riskClass}</span>
                        <span>{item.probability}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(2, item.probability)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-baseline gap-4 flex-wrap mt-5">
                  <p className="text-sm font-mono text-white">
                    Youth: {studentPct}%
                  </p>
                  <p className="text-sm font-mono text-white">
                    Families: {familiesPct}%
                  </p>
                  <p className="text-sm font-mono text-white">
                    Seniors: {retireesPct}%
                  </p>
                </div>

                <p className="text-[10px] text-muted-foreground uppercase mt-2">
                  Status:{" "}
                  {dashboardData.people_location_packet.meta.status ||
                    "unknown"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="scada-panel border-white/5 bg-background/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs lcd-text text-muted-foreground">
                    Demand Analysis
                  </p>
                  <Badge
                    variant="outline"
                    className="text-primary border-primary/30 uppercase"
                  >
                    {breakdown?.demand_analysis.level ?? "N/A"}
                  </Badge>
                </div>
                <p className="text-3xl font-mono text-primary mb-2">
                  {breakdown?.demand_analysis.score?.toFixed(1) ?? "N/A"}/100
                </p>
                <p className="text-xs text-white/75 leading-relaxed">
                  {breakdown?.demand_analysis.summary ??
                    "Demand analysis is not available for this scenario."}
                </p>
                <div className="space-y-2 mt-4">
                  {(breakdown?.demand_analysis.signals ?? [])
                    .slice(0, 2)
                    .map((signal) => (
                      <p
                        key={signal}
                        className="text-[11px] text-white/60 border-l border-primary/40 pl-2"
                      >
                        {signal}
                      </p>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="scada-panel border-white/5 bg-background/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs lcd-text text-muted-foreground">
                    Competition Analysis
                  </p>
                  <Badge
                    variant="outline"
                    className={indicatorBadgeClass(
                      dashboardData.competition_monitor.indicator,
                    )}
                  >
                    {breakdown?.competition_analysis.level ?? "N/A"}
                  </Badge>
                </div>
                <p
                  className={`text-3xl font-mono mb-2 ${indicatorTextClass(dashboardData.competition_monitor.indicator)}`}
                >
                  {breakdown?.competition_analysis.score?.toFixed(1) ?? "N/A"}
                  /100
                </p>
                <p className="text-xs text-white/75 leading-relaxed">
                  {breakdown?.competition_analysis.summary ??
                    "Competition analysis is not available for this scenario."}
                </p>
                <div className="space-y-2 mt-4">
                  {(breakdown?.competition_analysis.signals ?? [])
                    .slice(0, 2)
                    .map((signal) => (
                      <p
                        key={signal}
                        className="text-[11px] text-white/60 border-l border-accent/40 pl-2"
                      >
                        {signal}
                      </p>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="scada-panel border-white/5 bg-background/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs lcd-text text-muted-foreground">
                    Lease Cost Analysis
                  </p>
                  <Badge
                    variant="outline"
                    className="text-white/80 border-white/20 uppercase"
                  >
                    {breakdown?.lease_cost_analysis.level ?? "N/A"}
                  </Badge>
                </div>
                <p className="text-3xl font-mono text-white mb-2">
                  {formatCurrency(
                    breakdown?.lease_cost_analysis.metrics
                      .monthly_lease_cost_estimate,
                  )}
                </p>
                <p className="text-xs text-white/75 leading-relaxed">
                  {breakdown?.lease_cost_analysis.summary ??
                    "Lease cost analysis is not available for this scenario."}
                </p>
                <div className="space-y-2 mt-4">
                  {(breakdown?.lease_cost_analysis.signals ?? [])
                    .slice(0, 2)
                    .map((signal) => (
                      <p
                        key={signal}
                        className="text-[11px] text-white/60 border-l border-white/30 pl-2"
                      >
                        {signal}
                      </p>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="scada-panel border-white/5 bg-background/50 md:col-span-2">
              <CardContent className="p-5">
                <p className="text-xs lcd-text text-muted-foreground mb-2">
                  Prediction Explanation
                </p>
                <div className="space-y-3 text-sm text-white/80">
                  <p>
                    {explanation?.revenue_explanation ??
                      "Revenue explanation is not available for this scenario."}
                  </p>
                  <p>
                    {explanation?.risk_explanation ??
                      "Risk explanation is not available for this scenario."}
                  </p>
                  <p>
                    {explanation?.feasibility_explanation ??
                      "Feasibility explanation is not available for this scenario."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="scada-panel border-white/5 bg-background/50">
              <CardContent className="p-5">
                <p className="text-xs lcd-text text-muted-foreground mb-3">
                  Main Drivers
                </p>

                <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-2">
                  Positive Factors
                </p>
                <div className="space-y-2 mb-4">
                  {(explanation?.top_positive_factors ?? []).map((factor) => (
                    <p
                      key={factor}
                      className="text-xs text-white/75 border-l border-emerald-400/40 pl-2"
                    >
                      {factor}
                    </p>
                  ))}
                </div>

                <p className="text-[10px] text-destructive uppercase tracking-widest mb-2">
                  Negative Factors
                </p>
                <div className="space-y-2">
                  {(explanation?.top_negative_factors ?? []).map((factor) => (
                    <p
                      key={factor}
                      className="text-xs text-white/75 border-l border-destructive/40 pl-2"
                    >
                      {factor}
                    </p>
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
