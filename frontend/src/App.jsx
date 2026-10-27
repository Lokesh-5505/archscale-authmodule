import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { RoleRoute } from './auth/RoleRoute.jsx';
import { useAuth } from './auth/useAuth.js';

import { LoginPage } from './pages/LoginPage.jsx';
import { ChooseProfilePage } from './pages/ChooseProfilePage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import { AcceptInvitePage } from './pages/AcceptInvitePage.jsx';
import { LinkProblemPage } from './pages/LinkProblemPage.jsx';
import { MembershipEndedPage } from './pages/MembershipEndedPage.jsx';
import { SecurityPage } from './pages/SecurityPage.jsx';
import { AdminInvitationsPage } from './pages/AdminInvitationsPage.jsx';

function RootRedirect() {
  const { user, contexts, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.platformRole === 'super_admin') {
    return <Navigate to="/admin/invitations" replace />;
  }

  if (user?.platformRole === 'admin') {
    return <Navigate to="/security" replace />;
  }

  // Subscriber context routing per TDD §5.6
  const activeContexts = (contexts || []).filter((c) => c.isActive);
  if (activeContexts.length === 1) {
    return <Navigate to="/security" replace />;
  }
  if (activeContexts.length > 1) {
    return <Navigate to="/choose-profile" replace />;
  }
  return <Navigate to="/membership-ended" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Screens */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/link-problem" element={<LinkProblemPage />} />

          {/* Protected Subscriber / Account Screens */}
          <Route
            path="/choose-profile"
            element={
              <ProtectedRoute>
                <ChooseProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/membership-ended"
            element={
              <ProtectedRoute>
                <MembershipEndedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security"
            element={
              <ProtectedRoute>
                <SecurityPage />
              </ProtectedRoute>
            }
          />

          {/* Super Admin Restricted Screens */}
          <Route
            path="/admin/invitations"
            element={
              <RoleRoute allowedRoles={['super_admin']}>
                <AdminInvitationsPage />
              </RoleRoute>
            }
          />

          {/* Root and Fallback */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
