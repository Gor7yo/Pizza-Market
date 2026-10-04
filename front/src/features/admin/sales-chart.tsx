'use client';

import type { DashboardStatsDto } from '@market/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMoney } from '@/lib/money';
import styles from './admin.module.css';

const HEIGHT = 200;
const PAD_LEFT = 8;
const PAD_BOTTOM = 22;
const GAP = 2;

/**
 * Single-series revenue-per-day column chart (one hue, no legend needed):
 * thin rounded columns, recessive grid, per-column hover/focus tooltip,
 * and an equivalent table for screen readers.
 */
export function SalesChart({ data }: { data: DashboardStatsDto['salesByDay'] }) {
  const t = useTranslations('admin.dashboard');
  const format = useFormatter();
  const money = useMoney();
  const [active, setActive] = useState<number | null>(null);

  const width = Math.max(320, data.length * 18);
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const plotHeight = HEIGHT - PAD_BOTTOM;
  const step = (width - PAD_LEFT) / Math.max(1, data.length);
  const barWidth = Math.max(3, Math.min(18, step - GAP));
  const labelEvery = Math.ceil(data.length / 8);
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00`), { day: 'numeric', month: 'short' });
  const activeDay = active !== null ? data[active] : undefined;

  return (
    <div className={styles.chart}>
      <svg
        className={styles.chartSvg}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('salesChartLabel')}
        onMouseLeave={() => setActive(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            className={styles.gridLine}
            x1={0}
            x2={width}
            y1={plotHeight * (1 - f)}
            y2={plotHeight * (1 - f)}
          />
        ))}
        {data.map((d, i) => {
          const h = d.revenue > 0 ? Math.max(4, (d.revenue / max) * (plotHeight - 8)) : 0;
          const x = PAD_LEFT + i * step + (step - barWidth) / 2;
          return (
            <g key={d.date}>
              {/* generous hit target, larger than the mark */}
              <rect
                x={PAD_LEFT + i * step}
                y={0}
                width={step}
                height={plotHeight}
                fill="transparent"
                tabIndex={0}
                aria-label={`${day(d.date)}: ${money.format(d.revenue)}, ${t('ordersCount', { count: d.orders })}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
              {h > 0 ? (
                <path
                  className={`${styles.bar} ${active !== null && active !== i ? styles.barDim : ''}`}
                  d={`M${x},${plotHeight} v${-(h - 4)} q0,-4 4,-4 h${barWidth - 8} q4,0 4,4 v${h - 4} z`}
                  pointerEvents="none"
                />
              ) : null}
              {i % labelEvery === 0 ? (
                <text
                  className={styles.axisText}
                  x={x + barWidth / 2}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                >
                  {day(d.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {activeDay && active !== null ? (
        <div
          className={styles.tooltip}
          style={{ left: `${((PAD_LEFT + active * step + step / 2) / width) * 100}%` }}
        >
          <strong>{day(activeDay.date)}</strong>
          <br />
          {money.format(activeDay.revenue)} · {t('ordersCount', { count: activeDay.orders })}
        </div>
      ) : null}
      <table className="visually-hidden">
        <caption>{t('salesChartLabel')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('date')}</th>
            <th scope="col">{t('revenue')}</th>
            <th scope="col">{t('orders')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{day(d.date)}</td>
              <td>{money.format(d.revenue)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
