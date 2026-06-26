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
type CdfRow   = { bin: string } & BinCounts;
type ShareRow = { bin: string; SAME: number; DIFFERENT: number; UNKNOWN: number; total: number };

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

function buildCdf(rows: DistributionRow[], metric: "name" | "image"): CdfRow[] {
  const { map, sorted } = aggregateBins(rows, metric);
  if (!map.size) return [];
  let cumSame = 0, cumDiff = 0, cumUnk = 0;
  return sorted.map(([bin, counts]) => {
    cumSame += counts.SAME;
    cumDiff += counts.DIFFERENT;
    cumUnk  += counts.UNKNOWN;
    const cumTotal = cumSame + cumDiff + cumUnk;
    return {
      bin:       bin.toFixed(2),
      SAME:      parseFloat(((cumSame / cumTotal) * 100).toFixed(1)),
      DIFFERENT: parseFloat(((cumDiff / cumTotal) * 100).toFixed(1)),
      UNKNOWN:   parseFloat(((cumUnk  / cumTotal) * 100).toFixed(1)),
    };
  });
}

function buildShare(rows: DistributionRow[], metric: "name" | "image"): ShareRow[] {
  const { sorted } = aggregateBins(rows, metric);
  return sorted.map(([bin, counts]) => {
    const t = counts.SAME + counts.DIFFERENT + counts.UNKNOWN;
    return {
      bin:       bin.toFixed(2),
      total:     t,
      SAME:      t ? parseFloat(((counts.SAME      / t) * 100).toFixed(1)) : 0,
      DIFFERENT: t ? parseFloat(((counts.DIFFERENT / t) * 100).toFixed(1)) : 0,
      UNKNOWN:   t ? parseFloat(((counts.UNKNOWN   / t) * 100).toFixed(1)) : 0,
    };
  });
}

type TooltipPayload = { name: string; value: number; fill: string };

function CdfTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload[payload.length - 1]?.value ?? 0;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-stone-600 mb-1">≤ {label}</p>
      {[...payload].reverse().map((p) => p.value > 0 && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-stone-500">{p.name}:</span>
          <span className="font-bold text-stone-800">{p.value.toFixed(1)}%</span>
        </div>
      ))}
      <div className="border-t border-stone-100 pt-1 mt-1 flex justify-between">
        <span className="text-stone-400">cumulative total</span>
        <span className="font-bold text-stone-700">{total.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ShareTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-stone-600 mb-1">bin: {label}</p>
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

function ShareChart({ data, title, refLine, refLabel }: {
  data: ShareRow[];
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
          <Tooltip content={<ShareTooltip />} />
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
  const nameCdf   = buildCdf(data, "name");
  const imageCdf  = buildCdf(data, "image");
  const nameShare = buildShare(data, "name");
  const imageShare = buildShare(data, "image");

  return (
    <div className="space-y-6">
      {/* CDF charts */}
      <div className="space-y-2">
        <p className="text-xs text-stone-500 leading-relaxed">
          <span className="font-semibold text-stone-600">Cumulative composition</span> — each bar shows the
          SAME/DIFFERENT/UNKNOWN share of all pairs scoring at or below that score.
          As the threshold moves right, watch the{" "}
          <span className="text-green-600 font-semibold">green (SAME)</span> share grow —
          the crossover point is where setting the threshold starts costing you true matches.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <CdfChart data={nameCdf}  title="Name similarity — cumulative" refLine={0.50} refLabel="threshold 0.50" />
          <CdfChart data={imageCdf} title="Image similarity — cumulative" refLine={0.80} refLabel="threshold 0.80" />
        </div>
      </div>

      {/* Share charts */}
      <div className="space-y-2">
        <p className="text-xs text-stone-500 leading-relaxed">
          <span className="font-semibold text-stone-600">Share per bin</span> — each bar sums to 100%, showing the
          composition of pairs at that exact score.{" "}
          <span className="text-green-600 font-semibold">Green (SAME)</span> should dominate on the right;{" "}
          <span className="text-red-500 font-semibold">red (DIFFERENT)</span> on the left.
          Set the threshold where green starts becoming the majority.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ShareChart data={nameShare}  title="Name similarity — share per bin" refLine={0.50} refLabel="threshold 0.50" />
          <ShareChart data={imageShare} title="Image similarity — share per bin" refLine={0.80} refLabel="threshold 0.80" />
        </div>
      </div>
    </div>
  );
}
