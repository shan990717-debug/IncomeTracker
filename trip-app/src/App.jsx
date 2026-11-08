import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTripState, actions } from './lib/store';
import TripLayout from './components/TripLayout';
import LoginScreen, { NewPasswordScreen } from './components/LoginScreen';
import JoinPage from './pages/JoinPage';
import Saves from './pages/Saves';
import Tips from './pages/Tips';

function Gate() {
  const { phase, recovering } = useTripState();
  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (phase === 'signedOut') return <LoginScreen />;
  if (recovering) return <NewPasswordScreen onDone={() => actions.doneRecovering()} />;
  return (
    <Routes>
      <Route path="/join/:code" element={<JoinPage />} />
      <Route element={<TripLayout />}>
        <Route path="/" element={<Saves />} />
        <Route path="/tips" element={<Tips />} />
        {/* Android share sheet lands here; TripLayout reads the params and opens 收集. */}
        <Route path="/share" element={<Saves />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Gate />
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}
