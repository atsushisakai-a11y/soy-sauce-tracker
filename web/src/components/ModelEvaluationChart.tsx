"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export type EvalRow = {
  evaluated_at: string;
  total_pairs: number;
  matched_with_gt: number;
  not_in_gt: number;
  gt_coverage_pct: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
};

type TooltipPayload = {
  name: string;
  value: number;
  color: string;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold text-stone-600 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-stone-500 capitalize">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function ModelEvaluationChart({ data }: { data: EvalRow[] }) {
  if (!data.length) return null;

  const latest = data[data.length - 1];
  const hasTrend = data.length > 1;

  const chartData = data.map((r) => ({
    date: r.evaluated_at,
    precision: r.precision,
    recall: r.recall,
    f1: r.f1,
    accuracy: r.accuracy,
  }));

  return (
    <div className="space-y-6">

      {/* Metric scorecards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Precision", value: latest.precision, color: "text-blue-600",   border: "border-blue-100",  bg: "bg-blue-50",  desc: "TP / (TP + FP)" },
          { label: "Recall",    value: latest.recall,    color: "text-green-600",  border: "border-green-100", bg: "bg-green-50", desc: "TP / (TP + FN)" },
          { label: "F1",        value: latest.f1,        color: "text-purple-600", border: "border-purple-100",bg: "bg-purple-50",desc: "Harmonic mean" },
          { label: "Accuracy",  value: latest.accuracy,  color: "text-amber-600",  border: "border-amber-100", bg: "bg-amber-50", desc: "(TP + TN) / total" },
        ].map((m) => (
          <div key={m.label} className={`rounded-2xl border ${m.border} ${m.bg} p-5`}>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">{m.label}</p>
            <p className={`text-4xl font-bold mt-1 ${m.color}`}>{(m.value * 100).toFixed(1)}%</p>
            <p className="text-xs text-stone-400 font-mono mt-1">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Confusion matrix + coverage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Confusion matrix */}
        <div className="bg-white border border-stone-100 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Confusion Matrix</p>
          <div className="grid grid-cols-2 gap-px bg-stone-100 rounded-xl overflow-hidden text-center text-sm">
            <div className="bg-green-50 p-4">
              <p className="text-xs text-stone-400 mb-1">True Positive</p>
              <p className="text-2xl font-bold text-green-600">{latest.true_positive}</p>
              <p className="text-xs text-stone-400 mt-0.5">SAME + matched</p>
            </div>
            <div className="bg-orange-50 p-4">
              <p className="text-xs text-stone-400 mb-1">False Positive</p>
              <p className="text-2xl font-bold text-orange-500">{latest.false_positive}</p>
              <p className="text-xs text-stone-400 mt-0.5">DIFF + matched</p>
            </div>
            <div className="bg-red-50 p-4">
              <p className="text-xs text-stone-400 mb-1">False Negative</p>
              <p className="text-2xl font-bold text-red-500">{latest.false_negative}</p>
              <p className="text-xs text-stone-400 mt-0.5">SAME + missed</p>
            </div>
            <div className="bg-stone-50 p-4">
              <p className="text-xs text-stone-400 mb-1">True Negative</p>
              <p className="text-2xl font-bold text-stone-600">{latest.true_negative}</p>
              <p className="text-xs text-stone-400 mt-0.5">DIFF + rejected</p>
            </div>
          </div>
        </div>

        {/* Ground truth coverage */}
        <div className="bg-white border border-stone-100 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Ground Truth Coverage</p>
          <div className="space-y-3">
            {[
              { label: "Total pairs evaluated",     value: latest.total_pairs,    color: "text-stone-800" },
              { label: "Matched with ground truth", value: latest.matched_with_gt, color: "text-indigo-600" },
              { label: "Not in ground truth",       value: latest.not_in_gt,       color: "text-stone-400" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-xs text-stone-500">{r.label}</span>
                <span className={`text-sm font-bold ${r.color}`}>{r.value}</span>
              </div>
            ))}
            {/* Coverage bar */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-stone-400">Coverage</span>
                <span className="text-xs font-bold text-indigo-600">{latest.gt_coverage_pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${latest.gt_coverage_pct}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed pt-1">
            Pairs without a ground truth label are counted but excluded from metric computation.
            Coverage grows as the manual validation set is extended.
          </p>
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white border border-stone-100 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">
            Metrics over time
          </p>
          {!hasTrend && (
            <span className="text-xs text-stone-300 italic">1 run so far — trend will appear after more runs</span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#a8a29e" }}
              tickFormatter={(v) => v.slice(0, 10)}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 10, fill: "#a8a29e" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => <span style={{ textTransform: "capitalize" }}>{v}</span>}
            />
            <ReferenceLine y={0.8} stroke="#e5e7eb" strokeDasharray="4 3" />
            <Line type="monotone" dataKey="precision" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="recall"    stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: "#22c55e" }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="f1"        stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: "#a855f7" }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="accuracy"  stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: "#f59e0b" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
