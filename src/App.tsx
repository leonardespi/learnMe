import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/shared/layout/AppLayout'
import { DevConsole } from '@/shared/dev/DevConsole'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
    mutations: {
      onError: (error) => console.error('[mutation]', error),
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
      {import.meta.env.DEV && <DevConsole />}
    </QueryClientProvider>
  )
}
