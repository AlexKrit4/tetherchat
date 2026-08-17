import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Upload } from 'lucide-react';
import { LIMITS } from '@tetherchat/shared';
import type { SelfUser } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { queryKeys } from '@/lib/queryKeys';

/** Avatar, display name, bio and custom status. Shared by desktop and mobile. */
export function ProfileSettings() {
  const t = useT();
  const client = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  const save = useMutation({
    mutationFn: (input: Partial<Pick<SelfUser, 'displayName' | 'customStatus' | 'bio'>>) =>
      api.patch<SelfUser>('/api/users/@me', input),
    onSuccess: (updated) => {
      setUser(updated);
      void client.invalidateQueries({ queryKey: queryKeys.me });
      toast.success(t('settings.profileUpdated'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<SelfUser>('/api/users/@me/avatar', form);
    },
    onSuccess: (updated) => {
      setUser(updated);
      toast.success(t('settings.avatarUpdated'));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeAvatar = useMutation({
    mutationFn: () => api.delete('/api/users/@me/avatar'),
    onSuccess: () => {
      if (user) setUser({ ...user, avatarUrl: null });
    },
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={80} />
        <div className="flex flex-col gap-2">
          <Button size="sm" onClick={() => fileRef.current?.click()} loading={uploadAvatar.isPending}>
            <Upload size={16} aria-hidden />
            {t('settings.changeAvatar')}
          </Button>
          {user.avatarUrl ? (
            <Button size="sm" variant="ghost" onClick={() => removeAvatar.mutate()}>
              <Trash2 size={16} aria-hidden />
              {t('settings.remove')}
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadAvatar.mutate(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      <Input
        label={t('settings.displayName')}
        value={displayName}
        maxLength={LIMITS.displayName.max}
        placeholder={user.username}
        hint={t('settings.displayHint')}
        onChange={(event) => setDisplayName(event.target.value)}
      />

      <Input
        label={t('settings.customStatus')}
        value={customStatus}
        maxLength={LIMITS.customStatus.max}
        placeholder={t('settings.customStatusPlaceholder')}
        onChange={(event) => setCustomStatus(event.target.value)}
      />

      <Textarea
        label={t('settings.about')}
        rows={4}
        value={bio}
        maxLength={LIMITS.bio.max}
        placeholder={t('settings.aboutPlaceholder')}
        onChange={(event) => setBio(event.target.value)}
      />

      <Button
        loading={save.isPending}
        onClick={() =>
          save.mutate({
            displayName: displayName.trim() || null,
            customStatus: customStatus.trim() || null,
            bio: bio.trim() || null,
          })
        }
      >
        {t('settings.saveChanges')}
      </Button>
    </div>
  );
}
