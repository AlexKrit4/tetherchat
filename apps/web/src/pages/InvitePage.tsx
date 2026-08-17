import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { InvitePreview } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useJoinServer } from '@/hooks/useServers';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { serverInitials } from '@/components/layout/ServerRail';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/** Landing page for tetherchat.ru/invite/<code>, reachable while signed out. */
export function InvitePage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const join = useJoinServer();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.invitePreview(code),
    queryFn: () => api.get<InvitePreview>(`/api/invite/${code}`),
    enabled: code.length > 0,
    retry: false,
  });

  if (isLoading) {
    return (
      <AuthLayout title="Checking invite…">
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </AuthLayout>
    );
  }

  if (error || !data) {
    return (
      <AuthLayout title="Invalid invite" subtitle="This invite has expired or never existed.">
        <Button fullWidth size="lg" onClick={() => navigate('/')}>
          Go to TetherChat
        </Button>
      </AuthLayout>
    );
  }

  const inviterName = data.inviter.displayName ?? data.inviter.username;

  return (
    <AuthLayout
      title={data.server.name}
      subtitle={`${inviterName} invited you to join · ${data.server.memberCount} members`}
      footer={
        status === 'anonymous' ? (
          <>
            Already have an account?{' '}
            <Link to="/login" className="text-text-link hover:underline">
              Log in
            </Link>
          </>
        ) : null
      }
    >
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-base-tertiary text-xl font-semibold text-text">
          {data.server.iconUrl ? (
            <img src={data.server.iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            serverInitials(data.server.name)
          )}
        </span>

        {data.server.description ? (
          <p className="text-center text-base text-text-muted">{data.server.description}</p>
        ) : null}

        {status === 'authenticated' ? (
          <Button
            fullWidth
            size="lg"
            loading={join.isPending}
            onClick={() =>
              data.alreadyMember
                ? navigate(`/channels/${data.server.id}`)
                : join.mutate(code, {
                    onSuccess: ({ serverId }) => navigate(`/channels/${serverId}`),
                    onError: (joinError) => toast.error(errorMessage(joinError)),
                  })
            }
          >
            {data.alreadyMember ? 'Open server' : 'Accept invite'}
          </Button>
        ) : (
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate('/register', { state: { from: `/invite/${code}` } })}
          >
            Sign up to join
          </Button>
        )}
      </div>
    </AuthLayout>
  );
}
