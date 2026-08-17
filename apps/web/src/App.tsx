import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { UpdatePrompt } from '@/components/system/UpdatePrompt';
import { Spinner } from '@/components/ui/Spinner';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { InvitePage } from '@/pages/InvitePage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/ForgotPasswordPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/i18n/useT';

export function App() {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <BootSplash />;

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<AnonymousOnly><LoginPage /></AnonymousOnly>} />
        <Route path="/register" element={<AnonymousOnly><RegisterPage /></AnonymousOnly>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />

        <Route
          path="/channels/:serverId/:channelId?"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to={`/channels/${DM_ROUTE}`} replace />} />
        <Route path="*" element={<Navigate to={`/channels/${DM_ROUTE}`} replace />} />
      </Routes>

      <Toaster />
      <UpdatePrompt />
    </ErrorBoundary>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function AnonymousOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((state) => state.status);
  if (status === 'authenticated') return <Navigate to={`/channels/${DM_ROUTE}`} replace />;
  return <>{children}</>;
}

function BootSplash() {
  const t = useT();
  return (
    <div className="flex h-screen-dvh flex-col items-center justify-center gap-3 bg-surface-tertiary">
      <Spinner className="h-8 w-8 text-brand" />
      <p className="text-base text-text-muted">{t('boot.connecting')}</p>
    </div>
  );
}
