"use client";

// Dependency-free SVG charts. The project ships no charting library, and the
// admin dashboard only needs simple bars / stacked bars / ranked bars.

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
}

/**
 * Grouped bar chart over a daily series.
 * Values are normalised against the max across every series so the bars share
 * one scale and stay comparable.
 */
export function BarChart({
  data,
  series,
  height = 180,
  formatValue = (n: number) => String(n),
}: {
  data: Record<string, number | string>[];
  series: SeriesSpec[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-gray-400">ডেটা নেই</p>;
  }

  const max = Math.max(
    1,
    ...data.flatMap((row) => series.map((s) => Number(row[s.key] ?? 0)))
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex items-end gap-[3px] overflow-x-auto" style={{ height }}>
        {data.map((row, index) => (
          <div
            key={index}
            className="group relative flex min-w-[6px] flex-1 flex-col justify-end gap-[2px]"
            title={`${row.date ?? ""}\n${series
              .map((s) => `${s.label}: ${formatValue(Number(row[s.key] ?? 0))}`)
              .join("\n")}`}
          >
            {series.map((s) => {
              const value = Number(row[s.key] ?? 0);
              const barHeight = Math.max(value > 0 ? 2 : 0, (value / max) * (height - 8));
              return (
                <div
                  key={s.key}
                  style={{ height: barHeight, background: s.color }}
                  className="w-full rounded-t-[2px] opacity-85 transition group-hover:opacity-100"
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export interface RankedItem {
  label: string;
  value: number;
  hint?: string;
}

/** Horizontal ranked bars — used for top users and occasion distribution. */
export function RankedBars({
  items,
  color = "#006A4E",
  emptyLabel = "কোনো তথ্য নেই",
}: {
  items: RankedItem[];
  color?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-xs text-gray-400">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-gray-700">{item.label}</span>
            <span className="shrink-0 font-semibold text-gray-900">{item.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: color }}
            />
          </div>
          {item.hint && <p className="mt-0.5 truncate text-[10px] text-gray-400">{item.hint}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Donut chart for a small set of categories, with a legend. */
export function DonutChart({
  items,
  size = 140,
}: {
  items: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-xs text-gray-400">কোনো তথ্য নেই</p>;
  }

  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          <circle r={radius} fill="none" stroke="#f3f4f6" strokeWidth={16} />
          {items.map((item) => {
            const fraction = item.value / total;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={item.label}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={16}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return element;
          })}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-900 text-lg font-bold"
        >
          {total}
        </text>
      </svg>

      <ul className="min-w-[140px] flex-1 space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-gray-900">
              {item.value} ({Math.round((item.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
