import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Spinner } from '@/components/ui/Spinner';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('failed');
      setMessage('This link is missing its token.');
      return;
    }

    void api
      .post('/api/auth/verify-email', { token })
      .then(() => setState('done'))
      .catch((error) => {
        setState('failed');
        setMessage(errorMessage(error));
      });
  }, [token]);

  return (
    <AuthLayout
      title={
        state === 'working' ? 'Verifying…' : state === 'done' ? 'Email confirmed' : 'Verification failed'
      }
      subtitle={state === 'failed' ? message : undefined}
      footer={
        <Link to="/login" className="text-text-link hover:underline">
          Continue to TetherChat
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
