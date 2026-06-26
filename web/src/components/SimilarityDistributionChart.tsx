"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";

export type DistributionRow = {
  metric: "name" | "image";
  bin: number;
  verdict: "SAME" | "DIFFERENT" | "UNKNOWN";
  cnt: number;
};

type BinCounts = { SAME: number; DIFFERENT: number; UNKNOWN: number };
type HistRow = { bin: string } & BinCounts;
type CdfRow  = { bin: string } & BinCounts;

function aggregateBins(rows: DistributionRow[], metric: "name" | "image") {
  const map = new Map<number, BinCounts>();
  let total = 0;
  for (const r of rows) {
    if (r.metric !== metric) continue;
    if (!map.has(r.bin)) map.set(r.bin, { SAME: 0, DIFFERENT: 0, UNKNOWN: 0 });
    map.get(r.bin)![r.verdict] += r.cnt;
    total += r.cnt;
  }
  return { map, total, sorted: Array.from(map.entries()).sort(([a], [b]) => a - b) };
}

// Cumulative absolute counts
function buildHist(rows: DistributionRow[], metric: "name" | "image"): HistRow[] {
  const { sorted } = aggregateBins(rows, metric);
  let cumSame = 0, cumDiff = 0, cumUnk = 0;
  return sorted.map(([bin, counts]) => {
    cumSame += counts.SAME;
    cumDiff += counts.DIFFERENT;
    cumUnk  += counts.UNKNOWN;
    return { bin: bin.toFixed(2), SAME: cumSame, DIFFERENT: cumDiff, UNKNOWN: cumUnk };
  });
}

// Cumulative composition — each bar sums to 100%, values are running totals normalised
function buildCdf(rows: DistributionRow[], metric: "name" | "image"): CdfRow[] {
  const { map, sorted } = aggregateBins(rows, metric);
  if (!map.size) return [];
  let cumSame = 0, cumDiff = 0, cumUnk = 0;
  return sorted.map(([bin, counts]) => {
    cumSame += counts.SAME;
    cumDiff += counts.DIFFERENT;
    cumUnk  += counts.UNKNOWN;
    const t = cumSame + cumDiff + cumUnk;
    return {
      bin:       bin.toFixed(2),
      SAME:      parseFloat(((cumSame / t) * 100).toFixed(1)),
      DIFFERENT: parseFloat(((cumDiff / t) * 100).toFixed(1)),
      UNKNOWN:   parseFloat(((cumUnk  / t) * 100).toFixed(1)),
    };
  });
}

type TooltipPayload = { name: string; value: number; fill: string };

function HistTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-stone-600 mb-1">≤ {label} (cumulative)</p>
      {[...payload].reverse().map((p) => p.value > 0 && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-stone-500">{p.name}:</span>
          <span className="font-bold text-stone-800">{p.value}</span>
        </div>
      ))}
      <div className="border-t border-stone-100 pt-1 mt-1 flex justify-between">
        <span className="text-stone-400">total pairs</span>
        <span className="font-bold text-stone-700">{total}</span>
      </div>
    </div>
  );
}

function CdfTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-stone-600 mb-1">≤ {label} (cumulative)</p>
      {[...payload].reverse().map((p) => p.value > 0 && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-stone-500">{p.name}:</span>
          <span className="font-bold text-stone-800">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function HistChart({ data, title, refLine, refLabel }: {
  data: HistRow[];
  title: string;
  refLine?: number;
  refLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide text-center">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="10%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
          <XAxis dataKey="bin" tick={{ fontSize: 9, fill: "#a8a29e" }} interval={1} />
          <YAxis tick={{ fontSize: 9, fill: "#a8a29e" }} />
          <Tooltip content={<HistTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          <Bar dataKey="SAME"      stackId="a" fill="#22c55e" />
          <Bar dataKey="DIFFERENT" stackId="a" fill="#ef4444" />
          <Bar dataKey="UNKNOWN"   stackId="a" fill="#d6d3d1" radius={[2, 2, 0, 0]} />
          {refLine !== undefined && (
            <ReferenceLine
              x={refLine.toFixed(2)}
              stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3"
              label={{ value: refLabel ?? `${refLine}`, position: "top", fontSize: 9, fill: "#7c3aed" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CdfChart({ data, title, refLine, refLabel }: {
  data: CdfRow[];
  title: string;
  refLine?: number;
  refLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide text-center">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -4, bottom: 0 }} barCategoryGap="10%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
          <XAxis dataKey="bin" tick={{ fontSize: 9, fill: "#a8a29e" }} interval={1} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: "#a8a29e" }} />
          <Tooltip content={<CdfTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          <Bar dataKey="SAME" stackId="a" fill="#22c55e">
            <LabelList dataKey="SAME" position="inside" style={{ fontSize: 8, fill: "#fff", fontWeight: 600 }}
              formatter={(v: number) => v >= 10 ? `${v}%` : ""} />
          </Bar>
          <Bar dataKey="DIFFERENT" stackId="a" fill="#ef4444">
            <LabelList dataKey="DIFFERENT" position="inside" style={{ fontSize: 8, fill: "#fff", fontWeight: 600 }}
              formatter={(v: number) => v >= 10 ? `${v}%` : ""} />
          </Bar>
          <Bar dataKey="UNKNOWN" stackId="a" fill="#d6d3d1" radius={[2, 2, 0, 0]}>
            <LabelList dataKey="UNKNOWN" position="inside" style={{ fontSize: 8, fill: "#78716c", fontWeight: 600 }}
              formatter={(v: number) => v >= 10 ? `${v}%` : ""} />
          </Bar>
          {refLine !== undefined && (
            <ReferenceLine
              x={refLine.toFixed(2)}
              stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3"
              label={{ value: refLabel ?? `${refLine}`, position: "top", fontSize: 9, fill: "#7c3aed" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SimilarityDistributionChart({ data }: { data: DistributionRow[] }) {
  const nameHist  = buildHist(data, "name");
  const imageHist = buildHist(data, "image");
  const nameCdf   = buildCdf(data, "name");
  const imageCdf  = buildCdf(data, "image");

  return (
    <div className="space-y-6">

      {/* Histogram — absolute counts */}
      <div className="space-y-2">
        <p className="text-xs text-stone-500 leading-relaxed">
          <span className="font-semibold text-stone-600">Cumulative counts</span> — running total of pairs
          at or below each score.{" "}
          <span className="text-green-600 font-semibold">Green = SAME</span>,{" "}
          <span className="text-red-500 font-semibold">Red = DIFFERENT</span>,{" "}
          <span className="text-stone-400 font-semibold">Grey = no ground truth</span>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <HistChart data={nameHist}  title="Name similarity — cumulative counts"  refLine={0.50} refLabel="threshold 0.50" />
          <HistChart data={imageHist} title="Image similarity — cumulative counts" refLine={0.80} refLabel="threshold 0.80" />
        </div>
      </div>

      {/* CDF — cumulative composition */}
      <div className="space-y-2">
        <p className="text-xs text-stone-500 leading-relaxed">
          <span className="font-semibold text-stone-600">Cumulative composition</span> — of all pairs scoring
          at or below each threshold, what share are SAME vs DIFFERENT?
          Watch the <span className="text-green-600 font-semibold">green</span> share grow left to right —
          the crossover where green overtakes red is the natural threshold.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <CdfChart data={nameCdf}  title="Name similarity — cumulative composition"  refLine={0.50} refLabel="threshold 0.50" />
          <CdfChart data={imageCdf} title="Image similarity — cumulative composition" refLine={0.80} refLabel="threshold 0.80" />
        </div>
      </div>

    </div>
  );
}
