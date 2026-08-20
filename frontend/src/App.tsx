import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { RootLayout } from './layouts/RootLayout';
import { CitizenHomePage } from './pages/citizen/CitizenHomePage';
import { CitizenReportPage } from './pages/citizen/CitizenReportPage';
import { CitizenTrackPage } from './pages/citizen/CitizenTrackPage';
import { LoginPage } from './pages/LoginPage';
import { WorkerDashboardPage } from './pages/worker/WorkerDashboardPage';
import { WorkerTaskDetailPage } from './pages/worker/WorkerTaskDetailPage';
import { ReviewerInvestigationPage } from './pages/reviewer/ReviewerInvestigationPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { EvidenceInvestigationDemo } from './pages/EvidenceInvestigationDemo';
import { RequireAuth } from './components/RequireAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootLayout />}>
              {/* Citizen Public Routes */}
              <Route index element={<CitizenHomePage />} />
              <Route path="how-it-works" element={<CitizenHomePage />} />
              <Route path="citizen" element={<CitizenHomePage />} />
              <Route path="report" element={<CitizenReportPage />} />
              <Route path="citizen/report" element={<CitizenReportPage />} />
              <Route path="track" element={<CitizenTrackPage />} />
              <Route path="citizen/track" element={<CitizenTrackPage />} />

              {/* Portal Login */}
              <Route path="login" element={<LoginPage />} />

              {/* Hackathon Judging Demo */}
              <Route path="investigate" element={<EvidenceInvestigationDemo />} />
              <Route path="demo" element={<EvidenceInvestigationDemo />} />

              {/* Worker Routes */}
              <Route
                path="worker/dashboard"
                element={
                  <RequireAuth allowedRoles={['FIELD_WORKER', 'ADMIN']}>
                    <WorkerDashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="worker/tasks/:id"
                element={
                  <RequireAuth allowedRoles={['FIELD_WORKER', 'ADMIN']}>
                    <WorkerTaskDetailPage />
                  </RequireAuth>
                }
              />

              {/* Reviewer Routes */}
              <Route
                path="reviewer"
                element={
                  <RequireAuth allowedRoles={['REVIEWER', 'ADMIN']}>
                    <ReviewerInvestigationPage />
                  </RequireAuth>
                }
              />
              <Route
                path="reviewer/dashboard"
                element={
                  <RequireAuth allowedRoles={['REVIEWER', 'ADMIN']}>
                    <ReviewerInvestigationPage />
                  </RequireAuth>
                }
              />
              <Route
                path="reviewer/cases/:ticketId"
                element={
                  <RequireAuth allowedRoles={['REVIEWER', 'ADMIN']}>
                    <ReviewerInvestigationPage />
                  </RequireAuth>
                }
              />
              <Route
                path="reviewer/investigate/:ticketId"
                element={
                  <RequireAuth allowedRoles={['REVIEWER', 'ADMIN']}>
                    <ReviewerInvestigationPage />
                  </RequireAuth>
                }
              />

              {/* Admin Routes */}
              <Route
                path="admin/dashboard"
                element={
                  <RequireAuth allowedRoles={['ADMIN']}>
                    <AdminDashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="tickets"
                element={
                  <RequireAuth allowedRoles={['ADMIN', 'REVIEWER']}>
                    <TicketListPage />
                  </RequireAuth>
                }
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
