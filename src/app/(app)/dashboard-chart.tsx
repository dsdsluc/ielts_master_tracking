"use client";

import { useState } from "react";

export type ChartSeries = { key: string; label: string; color: string };
export type ChartPoint = { date: string; values: Record<string, number> };

const WIDTH = 900;
const HEIGHT = 280;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

function niceMax(value: number) {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function cumulativeAt(point: ChartPoint, series: ChartSeries[], uptoIndex: number) {
  let sum = 0;
  for (let i = 0; i < uptoIndex; i++) sum += point.values[series[i].key] ?? 0;
  return sum;
}

export function DashboardChart({ data, series }: { data: ChartPoint[]; series: ChartSeries[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const totals = data.map((d) => series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const step = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const xAt = (i: number) => PAD_LEFT + step * i;
  const yAt = (v: number) => PAD_TOP + plotHeight - (v / max) * plotHeight;

  const gridValues = [0, max / 2, max];

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = step > 0 ? Math.round((relativeX - PAD_LEFT) / step) : 0;
    setHoverIndex(Math.min(data.length - 1, Math.max(0, idx)));
  }

  if (data.length === 0 || series.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Không có dữ liệu trong khoảng đã chọn.</p>;
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Biểu đồ diễn biến liên hệ theo thời gian">
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yAt(v)} y2={yAt(v)} stroke="var(--color-border)" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yAt(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                {Math.round(v)}
              </text>
            </g>
          ))}

          {series.map((s, sIndex) => {
            const topPoints = data.map((d, i) => [xAt(i), yAt(cumulativeAt(d, series, sIndex + 1))] as const);
            const bottomPoints = data.map((d, i) => [xAt(i), yAt(cumulativeAt(d, series, sIndex))] as const);
            const path =
              topPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") +
              " " +
              bottomPoints
                .slice()
                .reverse()
                .map(([x, y]) => `L${x},${y}`)
                .join(" ") +
              " Z";
            return <path key={s.key} d={path} fill={s.color} fillOpacity={0.78} stroke="var(--color-card)" strokeWidth={1.5} />;
          })}

          {hoverIndex !== null && (
            <line x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={PAD_TOP} y2={PAD_TOP + plotHeight} stroke="var(--color-foreground)" strokeOpacity={0.35} strokeWidth={1} />
          )}

          {data.map((d, i) => {
            if (i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
            return (
              <text key={d.date} x={xAt(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {formatShortDate(d.date)}
              </text>
            );
          })}

          <rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>

        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md"
            style={{ left: `${(xAt(hoverIndex) / WIDTH) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-foreground">{formatShortDate(hovered.date)}</p>
            <div className="flex flex-col gap-0.5">
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="tabular-nums font-medium text-foreground">{hovered.values[s.key] ?? 0}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Diễn biến liên hệ theo thời gian</caption>
        <thead>
          <tr>
            <th>Ngày</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{formatShortDate(d.date)}</td>
              {series.map((s) => (
                <td key={s.key}>{d.values[s.key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
