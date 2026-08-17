import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { AuthLayout } from './AuthLayout';
import { Spinner } from '@/components/ui/Spinner';

export function VerifyEmailPage() {
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('failed');
      setMessage(t('auth.missingToken'));
      return;
    }

    void api
      .post('/api/auth/verify-email', { token })
      .then(() => setState('done'))
      .catch((error) => {
        setState('failed');
        setMessage(errorMessage(error));
      });
  }, [token, t]);

  return (
    <AuthLayout
      title={
        state === 'working'
          ? t('auth.verifyWorking')
          : state === 'done'
            ? t('auth.verifyDone')
            : t('auth.verifyFailed')
      }
      subtitle={state === 'failed' ? message : undefined}
      footer={
        <Link to="/login" className="text-text-link hover:underline">
          {t('auth.continueToApp')}
        </Link>
      }
    >
      {state === 'working' ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : null}
    </AuthLayout>
  );
}
