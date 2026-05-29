import React, { useEffect } from 'react';
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
import Today from '@/pages/Today.jsx';
import Calendar from '@/pages/Calendar';
import Settlement from '@/pages/Settlement';
import Claims from '@/pages/Claims';
import Goals from '@/pages/Goals';
import Review from '@/pages/Review';
import Settings from '@/pages/Settings';
import HouseholdBills from '@/pages/HouseholdBills';
import BillForm from '@/pages/BillForm';
import GoalForm from '@/pages/GoalForm';
import PaymentEditForm from '@/pages/PaymentEditForm';
import FamilyClaimForm from '@/pages/FamilyClaimForm';
import Records from '@/pages/Records.jsx';
import Planning from '@/pages/Planning.jsx';

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
        <Route path="/records" element={<Records />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/today" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/review" element={<Review />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/bills" element={<HouseholdBills />} />
        <Route path="/bills/new" element={<BillForm />} />
        <Route path="/bills/edit" element={<BillForm />} />
        <Route path="/goals/new" element={<GoalForm />} />
        <Route path="/goals/edit" element={<GoalForm />} />
        <Route path="/bills/payment/edit" element={<PaymentEditForm />} />
        <Route path="/bills/payment/new" element={<PaymentEditForm />} />
        <Route path="/family-claim/new" element={<FamilyClaimForm />} />
        <Route path="/family-claim/edit" element={<FamilyClaimForm />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function DarkModeSync() {
  useEffect(() => {
    const apply = (dark) => document.documentElement.classList.toggle('dark', dark);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);
    const handler = (e) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
          <DarkModeSync />
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