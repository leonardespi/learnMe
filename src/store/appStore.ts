import { create } from 'zustand'

type View =
  | { name: 'categories' }
  | { name: 'category-detail'; categoryId: string }
  | { name: 'study-detail'; studyId: string; categoryId: string }
  | { name: 'review-session'; studyId: string; categoryId: string }
  | { name: 'stats'; studyId: string; categoryId: string }
  | { name: 'settings' }

interface AppStore {
  view: View
  commandPaletteOpen: boolean
  navigateToCategories: () => void
  navigateToCategoryDetail: (categoryId: string) => void
  navigateToStudyDetail: (studyId: string, categoryId: string) => void
  navigateToReviewSession: (studyId: string, categoryId: string) => void
  navigateToStats: (studyId: string, categoryId: string) => void
  navigateToSettings: () => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  view: { name: 'categories' },
  commandPaletteOpen: false,
  navigateToCategories: () => set({ view: { name: 'categories' } }),
  navigateToCategoryDetail: (categoryId) =>
    set({ view: { name: 'category-detail', categoryId } }),
  navigateToStudyDetail: (studyId, categoryId) =>
    set({ view: { name: 'study-detail', studyId, categoryId } }),
  navigateToReviewSession: (studyId, categoryId) =>
    set({ view: { name: 'review-session', studyId, categoryId } }),
  navigateToStats: (studyId, categoryId) =>
    set({ view: { name: 'stats', studyId, categoryId } }),
  navigateToSettings: () => set({ view: { name: 'settings' } }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
}))
