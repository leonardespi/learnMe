// Phase 6 — StatsView unit tests.
// MUST FAIL (red) until src/features/stats/StatsView.tsx is created.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsView } from '@/features/stats/StatsView'
import type { DeckStats } from '@/features/stats/StatsView'

const makeStats = (overrides: Partial<DeckStats> = {}): DeckStats => ({
  retention: 0.8,
  byState: { new: 10, learning: 3, review: 7, relearning: 1 },
  heatmap: Array.from({ length: 365 }, (_, i) => (i >= 340 ? 4 : 0)),
  forecast: [5, 8, 12, 7, 9, 4, 5],
  ...overrides,
})

describe('StatsView', () => {
  it('shows empty state when stats is null', () => {
    render(<StatsView stats={null} />)
    expect(screen.getByTestId('stats-empty')).toBeInTheDocument()
  })

  it('displays retention as percentage', () => {
    render(<StatsView stats={makeStats({ retention: 0.8 })} />)
    expect(screen.getByTestId('retention-value').textContent).toMatch(/80/)
  })

  it('renders heatmap chart container', () => {
    render(<StatsView stats={makeStats()} />)
    expect(screen.getByTestId('heatmap-chart')).toBeInTheDocument()
  })

  it('renders forecast chart container', () => {
    render(<StatsView stats={makeStats()} />)
    expect(screen.getByTestId('forecast-chart')).toBeInTheDocument()
  })

  it('renders by-state new count', () => {
    render(<StatsView stats={makeStats({ byState: { new: 10, learning: 3, review: 7, relearning: 1 } })} />)
    expect(screen.getByTestId('by-state-new').textContent).toMatch(/10/)
  })
})
