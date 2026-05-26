import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export interface DeckStats {
  retention: number | null
  byState: { new: number; learning: number; review: number; relearning: number }
  heatmap: number[]
  forecast: number[]
}

interface Props {
  stats: DeckStats | null
}

const METRIC_LABEL: Record<string, string> = {
  retention: 'Retención (30d)',
  new: 'Nuevas',
  learning: 'Aprendiendo',
  review: 'Repaso',
  relearning: 'Reaprendiendo',
}

export function StatsView({ stats }: Props) {
  if (stats === null) {
    return (
      <div
        data-testid="stats-empty"
        className="px-6 py-12 text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        No hay datos todavía.
      </div>
    )
  }

  const retentionPct = stats.retention !== null ? Math.round(stats.retention * 100) : null
  const maxCount = Math.max(...stats.heatmap, 1)
  const forecastData = stats.forecast.map((count, i) => ({ day: `D${i}`, count }))

  const metrics = [
    { key: 'retention', value: retentionPct !== null ? `${retentionPct}%` : '—', testId: 'retention-value' },
    { key: 'new', value: stats.byState.new, testId: 'by-state-new' },
    { key: 'learning', value: stats.byState.learning, testId: 'by-state-learning' },
    { key: 'review', value: stats.byState.review, testId: 'by-state-review' },
    { key: 'relearning', value: stats.byState.relearning, testId: 'by-state-relearning' },
  ]

  return (
    <div data-testid="stats-view" className="px-6 py-8 space-y-10">
      {/* Metrics row — compact inline */}
      <div className="flex gap-6 flex-wrap pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        {metrics.map((m) => (
          <div key={m.key} className="space-y-0.5">
            <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {METRIC_LABEL[m.key]}
            </div>
            <div
              data-testid={m.testId}
              className="font-mono text-xl font-bold tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap — intrinsic size, never stretched */}
      <div data-testid="heatmap-chart" className="space-y-3">
        <h2
          className="font-mono text-[10px] font-bold tracking-widest uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Actividad (365 días)
        </h2>
        <div className="inline-flex flex-wrap gap-[2px]" style={{ width: 'auto' }}>
          {stats.heatmap.slice(0, 364).map((count, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                flexShrink: 0,
                background: count > 0 ? 'var(--accent)' : 'var(--bg)',
                opacity: count > 0 ? Math.max(0.2, count / maxCount) : 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Forecast — fixed-size chart, never stretched */}
      <div data-testid="forecast-chart" className="space-y-3">
        <h2
          className="font-mono text-[10px] font-bold tracking-widest uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          Previsión (7 días)
        </h2>
        <div className="inline-block">
          <BarChart width={380} height={130} data={forecastData}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
              }}
              cursor={{ fill: 'var(--interactive)' }}
            />
            <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </div>
      </div>
    </div>
  )
}
