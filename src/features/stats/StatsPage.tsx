import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { StatsView } from './StatsView'
import type { DeckStats } from './StatsView'
import { useAppStore } from '@/store/appStore'

interface Props {
  studyId: string
  categoryId: string
}

export function StatsPage({ studyId, categoryId }: Props) {
  const navigateToStudyDetail = useAppStore((s) => s.navigateToStudyDetail)

  const { data: stats = null } = useQuery<DeckStats>({
    queryKey: ['stats', studyId],
    queryFn: () => invoke('get_stats', { studyId }),
  })

  return (
    <div>
      <div
        className="flex items-center px-8 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => navigateToStudyDetail(studyId, categoryId)}
          className="font-mono text-xs transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ← Volver
        </button>
      </div>
      <StatsView stats={stats} />
    </div>
  )
}
