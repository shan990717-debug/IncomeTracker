import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTripState, actions, activeTrip } from './lib/store';
import { resumeUnfinished } from './lib/background';
import TripLayout, { LibraryLayout } from './components/TripLayout';
import LoginScreen, { NewPasswordScreen } from './components/LoginScreen';
import JoinPage from './pages/JoinPage';
import TripsHome from './pages/TripsHome';
import Overview from './pages/Overview';
import Saves from './pages/Saves';
import Tips from './pages/Tips';
import PlanSoon from './pages/PlanSoon';

/** Android share sheet → /share?title=&text=&url= → the last opened trip, with 收集 open. */
function ShareTarget() {
  const state = useTripState();
  const { search } = useLocation();
  const q = new URLSearchParams(search);
  const shareText = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n');
  const trip = activeTrip(state);
  return trip ? <Navigate to={`/t/${trip.id}`} replace state={{ shareText }} /> : <Navigate to="/" replace />;
}

function Gate() {
  const state = useTripState();
  const { phase, recovering } = state;
  // Posts saved before AI finished (app closed mid-way) get one more try on open.
  useEffect(() => { if (phase === 'ready') resumeUnfinished(); }, [phase]);

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
      <Route path="/" element={<TripsHome />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/share" element={<ShareTarget />} />
      <Route path="/t/:tripId" element={<TripLayout />}>
        <Route index element={<Overview />} />
        <Route path="library" element={<LibraryLayout />}>
          <Route index element={<Saves />} />
          <Route path="tips" element={<Tips />} />
        </Route>
        <Route path="plan" element={<PlanSoon />} />
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
