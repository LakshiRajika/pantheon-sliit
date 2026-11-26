import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import AppRouter from './routes/AppRouter'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry auth/permission/not-found errors; retry network blips once.
      retry: (count, err) => count < 1 && !(err?.status >= 400 && err?.status < 500),
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
