"use client";

import { useId, useState } from "react";

type Point = { date: string; count: number };

const WIDTH = 700;
const HEIGHT = 220;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function niceMax(value: number) {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function TrendChart({ data, seriesLabel }: { data: Point[]; seriesLabel: string }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = niceMax(Math.max(...data.map((d) => d.count), 0));
  const step = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const xAt = (i: number) => PAD_LEFT + step * i;
  const yAt = (v: number) => PAD_TOP + plotHeight - (v / max) * plotHeight;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.count)}`).join(" ");
  const areaPath = `${linePath} L${xAt(data.length - 1)},${PAD_TOP + plotHeight} L${xAt(0)},${PAD_TOP + plotHeight} Z`;

  const gridValues = [0, max / 2, max];
  const last = data[data.length - 1];
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = step > 0 ? Math.round((relativeX - PAD_LEFT) / step) : 0;
    setHoverIndex(Math.min(data.length - 1, Math.max(0, idx)));
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`Biểu đồ ${seriesLabel} theo ngày`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yAt(v)} y2={yAt(v)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yAt(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
              {Math.round(v)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hoverIndex !== null && (
          <line x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={PAD_TOP} y2={PAD_TOP + plotHeight} stroke="var(--color-border)" strokeWidth={1} />
        )}

        {data.map((d, i) => {
          const isEnd = i === data.length - 1;
          const isHovered = i === hoverIndex;
          if (!isEnd && !isHovered) return null;
          return (
            <circle
              key={d.date}
              cx={xAt(i)}
              cy={yAt(d.count)}
              r={isHovered ? 5 : 4}
              fill="var(--color-primary)"
              stroke="var(--color-card)"
              strokeWidth={2}
            />
          );
        })}

        {last && (
          <text x={xAt(data.length - 1)} y={yAt(last.count) - 10} textAnchor="end" className="fill-foreground text-[11px] font-semibold">
            {last.count}
          </text>
        )}

        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 7) !== 0 && i !== data.length - 1) return null;
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

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(xAt(hoverIndex!) / WIDTH) * 100}%` }}
        >
          <p className="font-semibold text-foreground tabular-nums">{hovered.count} liên hệ</p>
          <p className="text-muted-foreground">{formatShortDate(hovered.date)}</p>
        </div>
      )}

      <table className="sr-only">
        <caption>{seriesLabel} theo ngày</caption>
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Số lượng</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{formatShortDate(d.date)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
