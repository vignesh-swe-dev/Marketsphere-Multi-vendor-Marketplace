import React, { useState } from 'react';
import { formatMoney } from '../../lib/formatters.ts';

export interface SalesDataPoint {
  date: string;
  salesCents: number;
  ordersCount: number;
}

export interface SalesChartProps {
  data?: SalesDataPoint[];
  className?: string;
}

export const SalesChart: React.FC<SalesChartProps> = ({ data, className = '' }) => {
  const [hoveredPoint, setHoveredPoint] = useState<SalesDataPoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Real data only: the parent passes the last 7 days. With nothing sold, the chart is flat at zero.
  const points: SalesDataPoint[] = data && data.length > 1 ? data : [{ date: '', salesCents: 0, ordersCount: 0 }, { date: '', salesCents: 0, ordersCount: 0 }];

  const maxSales = Math.max(...points.map((p) => p.salesCents), 100000);
  const width = 600;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const getX = (idx: number) => {
    return paddingX + (idx / (points.length - 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    return height - paddingY - (val / maxSales) * (height - paddingY * 2);
  };

  const pathCoordinates = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.salesCents)}`)
    .join(' ');

  const areaCoordinates = `${pathCoordinates} L ${getX(points.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <div className="flex items-center justify-between mb-3 text-xs">
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-100">7-Day Revenue Velocity</span>
          <p className="text-slate-400 text-[11px]">Daily gross fulfillment receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span className="font-mono text-slate-600 dark:text-slate-400 text-xs">
            Peak: {formatMoney(maxSales)}
          </span>
        </div>
      </div>

      <div className="relative w-full h-[190px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height / 2}
            x2={width - paddingX}
            y2={height / 2}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
          />

          {/* Gradient Fill Area */}
          <path d={areaCoordinates} fill="url(#salesGradient)" />

          {/* Smooth Line */}
          <path
            d={pathCoordinates}
            fill="none"
            stroke="#4F46E5"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((p, idx) => {
            const cx = getX(idx);
            const cy = getY(p.salesCents);
            const isHovered = hoveredPoint?.date === p.date;

            return (
              <g key={p.date}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  className="fill-white dark:fill-slate-900 stroke-indigo-600 transition-all duration-150 cursor-pointer"
                  strokeWidth="2.5"
                  onMouseEnter={() => {
                    setHoveredPoint(p);
                    setHoverPos({ x: cx, y: cy });
                  }}
                  onMouseLeave={() => {
                    setHoveredPoint(null);
                    setHoverPos(null);
                  }}
                />
                <text
                  x={cx}
                  y={height - 6}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {p.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && hoverPos && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900 dark:bg-slate-800 text-white p-2 rounded-xl shadow-lg text-[11px] font-mono"
            style={{
              left: `${(hoverPos.x / width) * 100}%`,
              top: `${(hoverPos.y / height) * 100}%`,
            }}
          >
            <p className="font-bold text-indigo-300">{formatMoney(hoveredPoint.salesCents)}</p>
            <p className="text-[10px] text-slate-300">{hoveredPoint.ordersCount} orders</p>
          </div>
        )}
      </div>
    </div>
  );
};
