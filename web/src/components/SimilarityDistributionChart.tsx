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
} from "recharts";

export type DistributionRow = {
  metric: "name" | "image";
  bin: number;
  verdict: "SAME" | "DIFFERENT" | "UNKNOWN";
  cnt: number;
};

type BinRow = { bin: string; SAME: number; DIFFERENT: number; UNKNOWN: number };

function buildBins(rows: DistributionRow[], metric: "name" | "image"): BinRow[] {
  const map = new Map<number, BinRow>();
  for (const r of rows) {
    if (r.metric !== metric) continue;
    if (!map.has(r.bin)) {
      map.set(r.bin, { bin: r.bin.toFixed(2), SAME: 0, DIFFERENT: 0, UNKNOWN: 0 });
    }
    map.get(r.bin)![r.verdict] += r.cnt;
  }
  return Array.from(map.values()).sort((a, b) => parseFloat(a.bin) - parseFloat(b.bin));
}

type TooltipPayload = { name: string; value: number; fill: string };

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-stone-600 mb-1">score bin: {label}</p>
      {payload.map((p) => p.value > 0 && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-stone-500">{p.name}:</span>
          <span className="font-bold text-stone-800">{p.value}</span>
        </div>
      ))}
      <div className="border-t border-stone-100 pt-1 mt-1 flex justify-between">
        <span className="text-stone-400">total</span>
        <span className="font-bold text-stone-700">{total}</span>
      </div>
    </div>
  );
}

function DistChart({
  data, title, refLine, refLabel,
}: {
  data: BinRow[];
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
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 9, fill: "#a8a29e" }}
            interval={1}
          />
          <YAxis tick={{ fontSize: 9, fill: "#a8a29e" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          <Bar dataKey="SAME"      stackId="a" fill="#22c55e" />
          <Bar dataKey="DIFFERENT" stackId="a" fill="#ef4444" />
          <Bar dataKey="UNKNOWN"   stackId="a" fill="#d6d3d1" radius={[2, 2, 0, 0]} />
          {refLine !== undefined && (
            <ReferenceLine
              x={refLine.toFixed(2)}
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{ value: refLabel ?? `${refLine}`, position: "top", fontSize: 9, fill: "#7c3aed" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SimilarityDistributionChart({
  data,
}: {
  data: DistributionRow[];
}) {
  const nameBins  = buildBins(data, "name");
  const imageBins = buildBins(data, "image");

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500 leading-relaxed">
        Distribution of all evaluated pairs by similarity score.{" "}
        <span className="text-green-600 font-semibold">Green = SAME</span>{" "}
        (ground truth confirms a match),{" "}
        <span className="text-red-500 font-semibold">Red = DIFFERENT</span>{" "}
        (confirmed mismatch),{" "}
        <span className="text-stone-400 font-semibold">Grey = no ground truth label</span>.
        The purple line marks the current threshold candidate (0.50). Move it left to increase recall; right to increase precision.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DistChart
          data={nameBins}
          title="Name similarity (brand-stripped Jaccard)"
          refLine={0.50}
          refLabel="threshold 0.50"
        />
        <DistChart
          data={imageBins}
          title="Image similarity (DINOv2 × colour histogram)"
          refLine={0.80}
          refLabel="threshold 0.80"
        />
      </div>
    </div>
  );
}
