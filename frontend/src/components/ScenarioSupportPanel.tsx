import { useEffect, useMemo, useState } from "react";

import {
  checkScenarioSupportCoverage,
  type ScenarioSupportResponse,
} from "@/services/api";
import type {
  BusinessInputMode,
  BusinessResolutionResponse,
} from "@/components/BusinessResolverPanel";

type ScenarioSupportPanelProps = {
  municipalityName: string;
  businessSubcategory: string;
  radiusKm: number;
  businessInputMode: BusinessInputMode;
  customBusinessQuery: string;
  useCustomBusinessForMap: boolean;
  businessResolution: BusinessResolutionResponse | null;
  className?: string;
};

function badgeClass(status?: string): string {
  const normalized = (status || "").toLowerCase();

  if (normalized === "supported") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }

  if (normalized === "limited_supported" || normalized === "supported_limited" || normalized === "available_not_active") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }

  if (normalized === "needs_review") {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

function SectionCard({
  title,
  status,
  summary,
  reasons,
  nextSteps,
}: {
  title: string;
  status: string;
  summary: string;
  reasons: string[];
  nextSteps: string[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClass(status)}`}>
          {status.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{summary}</p>

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          {reasons.slice(0, 4).map((reason, index) => (
            <li key={`${title}-reason-${index}`} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-cyan-300/70" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {nextSteps.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-200">
            Required before stronger trust
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
            {nextSteps.slice(0, 3).map((step, index) => (
              <li key={`${title}-step-${index}`}>• {step}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ScenarioSupportPanel({
  municipalityName,
  businessSubcategory,
  radiusKm,
  businessInputMode,
  customBusinessQuery,
  useCustomBusinessForMap,
  businessResolution,
  className = "",
}: ScenarioSupportPanelProps) {
  const [support, setSupport] = useState<ScenarioSupportResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedOsmTagCount = useMemo(() => {
    if (!businessResolution?.osm_tags || !Array.isArray(businessResolution.osm_tags)) return 0;
    return businessResolution.osm_tags.length;
  }, [businessResolution]);

  useEffect(() => {
    let cancelled = false;

    async function checkSupport() {
      try {
        setIsChecking(true);
        setError(null);

        const payload = await checkScenarioSupportCoverage({
          municipality_name: municipalityName,
          business_subcategory: businessSubcategory,
          radius_km: radiusKm,
          business_input_mode: businessInputMode,
          custom_business_query: customBusinessQuery.trim() || null,
          use_custom_business_for_map: useCustomBusinessForMap,
          business_resolution_status: businessResolution?.status || null,
          resolved_osm_tag_count: resolvedOsmTagCount,
          business_resolution_confidence: businessResolution?.resolution_confidence || null,
        });

        if (!cancelled) {
          setSupport(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not check scenario support coverage.");
          setSupport(null);
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    }

    checkSupport();

    return () => {
      cancelled = true;
    };
  }, [
    municipalityName,
    businessSubcategory,
    radiusKm,
    businessInputMode,
    customBusinessQuery,
    useCustomBusinessForMap,
    businessResolution?.status,
    businessResolution?.resolution_confidence,
    resolvedOsmTagCount,
  ]);

  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-xl ${className}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
            Support coverage
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Scenario trust gate
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            This separates what Zonalyze can safely predict from what it can only use for map/evidence support.
          </p>
        </div>

        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass(support?.overall_status)}`}>
          {isChecking ? "checking" : support?.overall_label || "not checked"}
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {support && (
        <>
          <p className="mt-4 text-sm text-slate-300">{support.summary}</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SectionCard
              title={support.prediction_support.label}
              status={support.prediction_support.status}
              summary={support.prediction_support.summary}
              reasons={support.prediction_support.reasons || []}
              nextSteps={support.prediction_support.required_next_steps || []}
            />
            <SectionCard
              title={support.map_evidence_support.label}
              status={support.map_evidence_support.status}
              summary={support.map_evidence_support.summary}
              reasons={support.map_evidence_support.reasons || []}
              nextSteps={support.map_evidence_support.required_next_steps || []}
            />
          </div>

          {support.warnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-200">
                Warnings
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                {support.warnings.slice(0, 4).map((warning, index) => (
                  <li key={`support-warning-${index}`}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {support.data_trust_notes.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">
                Trust notes
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {support.data_trust_notes.slice(0, 4).map((note, index) => (
                  <li key={`support-note-${index}`}>• {note}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
