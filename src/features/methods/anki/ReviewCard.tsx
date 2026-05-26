import ReactMarkdown from 'react-markdown'
import type { Card } from '@/types/domain'

interface Props {
  card: Card
  phase: 'front' | 'back'
  onReveal: () => void
  onGrade: (grade: 1 | 2 | 3 | 4) => void
}

const GRADE_LABELS: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
const GRADE_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#10b981',
  4: '#3b82f6',
}

export function ReviewCard({ card, phase, onReveal, onGrade }: Props) {
  return (
    <div
      data-testid="review-card"
      className="flex flex-col items-center justify-center flex-1 py-8 gap-12"
    >
      {/* Front */}
      <div
        data-testid="card-front"
        className="font-medium text-center leading-relaxed max-w-2xl tracking-tight"
        style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)', color: 'var(--text)' }}
      >
        <ReactMarkdown>{card.front}</ReactMarkdown>
      </div>

      {phase === 'back' ? (
        <>
          <div className="w-12 h-[1px]" style={{ background: 'var(--border)' }} />

          <div
            data-testid="card-back"
            className="text-lg text-center leading-relaxed max-w-prose"
            style={{ color: 'var(--text-muted)' }}
          >
            <ReactMarkdown>{card.back}</ReactMarkdown>
          </div>

          <div data-testid="grade-buttons" className="flex gap-1 mt-4">
            {([1, 2, 3, 4] as const).map((g) => (
              <button
                key={g}
                onClick={() => onGrade(g)}
                className="px-5 py-2.5 text-sm font-medium rounded-sm transition-all duration-[120ms]"
                style={{
                  color: 'var(--text-muted)',
                  background: 'var(--surface)',
                  borderBottom: '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderBottomColor = GRADE_COLORS[g]
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderBottomColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                {GRADE_LABELS[g]}
                <span className="ml-1.5 font-mono text-[10px] opacity-40">{g}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          onClick={onReveal}
          aria-label="Show Answer"
          className="text-sm px-6 py-2 transition-colors duration-100"
          style={{
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.borderBottomColor = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderBottomColor = 'var(--border)'
          }}
        >
          Mostrar respuesta
          <span className="ml-2 font-mono text-[10px] opacity-40">Espacio</span>
        </button>
      )}
    </div>
  )
}
