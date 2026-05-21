import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider, useUser } from './contexts/UserContext';
import { RecordPage } from './pages/RecordPage';
import { ArticlePage } from './pages/ArticlePage';
import { LoginPage } from './pages/LoginPage';
import { ProgressPage } from './pages/ProgressPage';
import { StudySetsPage } from './pages/StudySetsPage';
import { StudySetDetailPage } from './pages/StudySetDetailPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { LearnPage } from './pages/LearnPage';
import { Loader2 } from 'lucide-react';
import './index.css';

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><RecordPage /></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
      <Route path="/article/:id" element={<ProtectedRoute><ArticlePage /></ProtectedRoute>} />
      <Route path="/sets" element={<ProtectedRoute><StudySetsPage /></ProtectedRoute>} />
      <Route path="/sets/:id" element={<ProtectedRoute><StudySetDetailPage /></ProtectedRoute>} />
      <Route path="/sets/:id/flashcards" element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
      <Route path="/sets/:id/learn" element={<ProtectedRoute><LearnPage /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
