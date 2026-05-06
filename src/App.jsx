import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { LanguageProvider } from '@/lib/i18n';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard.jsx';
import Today from '@/pages/Today';
import Calendar from '@/pages/Calendar';
import Settlement from '@/pages/Settlement';
import Claims from '@/pages/Claims';
import Goals from '@/pages/Goals';
import Review from '@/pages/Review';
import Settings from '@/pages/Settings';
import HouseholdBills from '@/pages/HouseholdBills';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/today" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/review" element={<Review />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/bills" element={<HouseholdBills />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;