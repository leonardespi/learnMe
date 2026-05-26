import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/shared/layout/AppLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
    </QueryClientProvider>
  )
}
