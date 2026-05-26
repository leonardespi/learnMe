import { useCallback, useEffect, useRef } from 'react'
import { useReviewSession } from './hooks/useReviewSession'
import { ReviewCard } from './ReviewCard'

interface Props {
  deckId: string
  onComplete?: () => void
  onExit?: () => void
}

export function ReviewSession({ deckId, onComplete, onExit }: Props) {
  const { currentCard, phase, progress, reveal, grade } = useReviewSession(deckId)

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const revealRef = useRef(reveal)
  revealRef.current = reveal
  const gradeRef = useRef(grade)
  gradeRef.current = grade

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const p = phaseRef.current
    if (p === 'complete') return
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      revealRef.current()
      return
    }
    if (p === 'back') {
      if (e.key === '1') void gradeRef.current(1)
      else if (e.key === '2') void gradeRef.current(2)
      else if (e.key === '3') void gradeRef.current(3)
      else if (e.key === '4') void gradeRef.current(4)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (phase === 'complete') onComplete?.()
  }, [phase, onComplete])

  const progressPct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  if (phase === 'complete') {
    return (
      <div
        data-testid="session-complete"
        className="flex flex-col items-center justify-center gap-6 min-h-[60vh] text-center px-8"
      >
        <div className="space-y-2">
          <h2
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            Sesión completa
          </h2>
          <p className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
            {progress.done} cartas repasadas
          </p>
        </div>
        {onExit && (
          <button
            onClick={onExit}
            className="flex items-center gap-2 rounded px-6 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            Volver
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="review-session"
      className="flex flex-col min-h-screen max-w-2xl mx-auto px-8 py-6"
    >
      {/* Progress */}
      <div className="flex items-center gap-4 mb-12">
        <div
          className="flex-1 h-[1px] overflow-hidden"
          style={{ background: 'var(--border)' }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: 'var(--text)',
            }}
          />
        </div>
        <span
          data-testid="progress-indicator"
          className="font-mono text-xs flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          {progress.done}/{progress.total}
        </span>
        {onExit && (
          <button
            onClick={onExit}
            className="font-mono text-xs transition-colors duration-100 flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Esc
          </button>
        )}
      </div>

      {currentCard && (
        <ReviewCard
          card={currentCard}
          phase={phase as 'front' | 'back'}
          onReveal={reveal}
          onGrade={grade}
        />
      )}

      <p
        className="text-center font-mono text-[10px] mt-auto pt-10 pb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Espacio para revelar · 1 Again · 2 Hard · 3 Good · 4 Easy
      </p>
    </div>
  )
}
