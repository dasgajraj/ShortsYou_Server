"use client";

import { useState } from "react";
import { BarChart3, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

const POWERBI_REPORT_ID = "eae22569-c368-4710-b346-2db7214ea4da";
const POWERBI_EMBED_BASE =
  process.env.NEXT_PUBLIC_POWERBI_EMBED_URL ||
  `https://app.powerbi.com/reportEmbed?reportId=${POWERBI_REPORT_ID}&autoAuth=true&ctid=`;

const PAGES = [
  { id: "10973e99337097e23800", label: "Overview" },
  { id: "aaaf9543589e2d2375d0", label: "Clip Intelligence" },
  { id: "50247dd2cce52894a48d", label: "Clip ML Scores" },
  { id: "d5934201bc9095578a02", label: "Trends & Genre" },
  { id: "ea196a5046b91dab0eed", label: "Model Quality" },
  { id: "2e7e95f17aaf8b083190", label: "Creator DNA & Gaps" },
] as const;

export function PowerBIDashboardsPanel() {
  const [activePageId, setActivePageId] = useState<string>(PAGES[0].id);
  const [expanded, setExpanded] = useState(false);

  const activePage = PAGES.find((p) => p.id === activePageId) ?? PAGES[0];
  const sep = POWERBI_EMBED_BASE.includes("?") ? "&" : "?";
  const embedSrc = `${POWERBI_EMBED_BASE}${sep}pageName=${activePage.id}`;

  return (
    <section
      aria-label="Power BI Embedded Dashboard"
      className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
              Power BI Analytics
            </h2>
            <p className="text-xs text-slate-500">
              {activePage.label} · Report {POWERBI_REPORT_ID}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 transition-colors"
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{expanded ? "Compact" : "Expand"}</span>
          </button>
          <a
            href={embedSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
          >
            <span>Open in Power BI</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Power BI Embedded Iframe */}
      <div className="p-3 sm:p-4 bg-[#F3F2F1]">
        <div
          className={`w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all ${
            expanded ? "h-[78vh] min-h-[540px]" : "aspect-video min-h-[420px] max-h-[720px]"
          }`}
        >
          <iframe
            key={activePage.id}
            title={`Power BI - ${activePage.label}`}
            src={embedSrc}
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      </div>

      {/* Power BI Bottom Report Page Tabs */}
      <div
        role="tablist"
        aria-label="Power BI Report Pages"
        className="flex items-center gap-1 px-4 sm:px-6 bg-white border-t border-slate-200/80 overflow-x-auto"
      >
        {PAGES.map((page) => {
          const active = page.id === activePage.id;
          return (
            <button
              key={page.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActivePageId(page.id)}
              className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors shrink-0 border-t-2 ${
                active
                  ? "border-[#F2C811] text-slate-900 bg-slate-50/80 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              }`}
            >
              {page.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
