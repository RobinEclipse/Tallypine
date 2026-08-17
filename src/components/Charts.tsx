import type { BalancePoint, CategorySpending } from "../../shared/types";
import { formatMoney, formatShortMoney } from "../lib/format";

interface ChartProps {
  currency: string;
}

export function SpendingChart({ rows, currency }: ChartProps & { rows: CategorySpending[] }) {
  const total = rows.reduce((sum, row) => sum + row.totalUnits, 0);
  if (!rows.length || total <= 0) {
    return <div className="chart-empty"><span>No spending here yet</span><small>Money Out transactions will appear in this chart.</small></div>;
  }
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <svg viewBox="0 0 180 180" role="img" aria-label="Spending by category">
          <circle className="donut-track" cx="90" cy="90" r={radius} />
          {rows.map((row) => {
            const length = (row.totalUnits / total) * circumference;
            const segment = (
              <circle
                key={row.name}
                className="donut-segment"
                cx="90" cy="90" r={radius}
                stroke={row.color}
                strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`}
                strokeDashoffset={-offset}
              >
                <title>{`${row.name}: ${formatMoney(row.totalUnits, currency)}`}</title>
              </circle>
            );
            offset += length;
            return segment;
          })}
        </svg>
        <div className="donut-total"><strong>{formatShortMoney(total, currency)}</strong><span>Total spent</span></div>
      </div>
      <div className="chart-legend">
        {rows.slice(0, 7).map((row) => (
          <div className="legend-row" key={row.name}>
            <span className="legend-dot" style={{ background: row.color }} />
            <span className="legend-name">{row.name}</span>
            <strong>{Math.round((row.totalUnits / total) * 100)}%</strong>
          </div>
        ))}
        {rows.length > 7 && <small>+{rows.length - 7} more categories</small>}
      </div>
    </div>
  );
}

export function BalanceChart({ points, currency }: ChartProps & { points: BalancePoint[] }) {
  if (!points.length) {
    return <div className="chart-empty"><span>No balance history yet</span></div>;
  }
  const width = 640;
  const height = 218;
  const left = 16;
  const right = 12;
  const top = 18;
  const bottom = 32;
  const values = points.map((point) => point.balanceUnits);
  const actualMinimum = Math.min(...values);
  const actualMaximum = Math.max(...values);
  let chartMinimum = actualMinimum;
  let chartMaximum = actualMaximum;
  if (chartMinimum === chartMaximum) {
    chartMinimum -= Math.max(100, Math.abs(chartMinimum) * 0.08);
    chartMaximum += Math.max(100, Math.abs(chartMaximum) * 0.08);
  }
  const padding = Math.max(100, (chartMaximum - chartMinimum) * 0.12);
  chartMinimum -= padding;
  chartMaximum += padding;
  const x = (index: number) => left + (index / Math.max(1, points.length - 1)) * (width - left - right);
  const y = (value: number) => top + ((chartMaximum - value) / (chartMaximum - chartMinimum)) * (height - top - bottom);
  const line = points.map((point, index) => `${index ? "L" : "M"} ${x(index).toFixed(2)} ${y(point.balanceUnits).toFixed(2)}`).join(" ");
  const area = `${line} L ${x(points.length - 1)} ${height - bottom} L ${x(0)} ${height - bottom} Z`;
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Balance over time" preserveAspectRatio="none">
        <defs>
          <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => (
          <line key={ratio} className="chart-gridline" x1={left} x2={width - right} y1={top + ratio * (height - top - bottom)} y2={top + ratio * (height - top - bottom)} />
        ))}
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
        {points.map((point, index) => (
          <circle key={`${point.date}-${index}`} className="chart-point" cx={x(index)} cy={y(point.balanceUnits)} r="3.2" tabIndex={0}>
            <title>{`${point.date}: ${formatMoney(point.balanceUnits, currency)}`}</title>
          </circle>
        ))}
        {labelIndexes.map((index) => (
          <text key={index} className="chart-date" x={x(index)} y={height - 9} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>
            {new Date(`${points[index].date}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          </text>
        ))}
      </svg>
      <div className="chart-range-labels"><span>{formatShortMoney(actualMaximum, currency)}</span><span>{formatShortMoney(actualMinimum, currency)}</span></div>
    </div>
  );
}
