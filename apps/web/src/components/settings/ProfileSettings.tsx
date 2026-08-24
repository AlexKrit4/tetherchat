import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Upload, Smartphone } from 'lucide-react';
import { LIMITS, PLUS_COLORS } from '@tetherchat/shared';
import type { SelfUser } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { queryKeys } from '@/lib/queryKeys';
import { ANDROID_APK_FILENAME, ANDROID_APK_PATH, isInstalledAndroidApp } from '@/lib/androidApp';
import { bioMax } from '@/lib/plusDisplay';
import { usePlusStore } from '@/stores/plusStore';

/** Avatar, display name, bio and custom status. Shared by desktop and mobile. */
export function ProfileSettings() {
  const t = useT();
  const client = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const showPlus = usePlusStore((state) => state.show);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [bannerColor, setBannerColor] = useState(user?.bannerColor ?? PLUS_COLORS[0]);
  const [accentColor, setAccentColor] = useState(user?.accentColor ?? user?.bannerColor ?? PLUS_COLORS[0]);
  const [hideLastSeen, setHideLastSeen] = useState(Boolean(user?.hideLastSeen));

  const maxBio = bioMax(user);

  const save = useMutation({
    mutationFn: (input: Partial<SelfUser>) => api.patch<SelfUser>('/api/users/@me', input),
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

  const requirePlus = (reason: 'colors' | 'lastSeen' | 'bio') => {
    if (user.isPlus) return false;
    showPlus(reason);
    return true;
  };

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
        maxLength={maxBio}
        placeholder={t('settings.aboutPlaceholder')}
        hint={`${bio.length} / ${maxBio}`}
        onChange={(event) => {
          const next = event.target.value;
          if (next.length > LIMITS.bio.max && !user.isPlus) {
            showPlus('bio');
            return;
          }
          setBio(next);
        }}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-text-heading">{t('plus.bannerColor')}</p>
        <div className="flex flex-wrap gap-2">
          {PLUS_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              className="h-8 w-8 rounded-full"
              style={{
                background: color,
                boxShadow: bannerColor === color ? '0 0 0 2px var(--header-primary)' : undefined,
              }}
              onClick={() => {
                if (requirePlus('colors')) return;
                setBannerColor(color);
              }}
            />
          ))}
        </div>
        <p className="mb-2 mt-3 text-sm font-medium text-text-heading">{t('plus.accentColor')}</p>
        <div className="flex flex-wrap gap-2">
          {PLUS_COLORS.map((color) => (
            <button
              key={`accent-${color}`}
              type="button"
              aria-label={color}
              className="h-8 w-8 rounded-full"
              style={{
                background: color,
                boxShadow: accentColor === color ? '0 0 0 2px var(--header-primary)' : undefined,
              }}
              onClick={() => {
                if (requirePlus('colors')) return;
                setAccentColor(color);
              }}
            />
          ))}
        </div>
        {!user.isPlus ? <p className="mt-2 text-xs text-text-muted">{t('plus.colorsHint')}</p> : null}
      </div>

      <label className="flex items-center gap-3 text-sm text-text">
        <input
          type="checkbox"
          checked={hideLastSeen}
          onChange={(event) => {
            if (requirePlus('lastSeen')) return;
            setHideLastSeen(event.target.checked);
          }}
        />
        <span>
          <span className="block font-medium">{t('plus.hideLastSeen')}</span>
          <span className="text-text-muted">{t('plus.hideLastSeenHint')}</span>
        </span>
      </label>

      <Button
        loading={save.isPending}
        onClick={() =>
          save.mutate({
            displayName: displayName.trim() || null,
            customStatus: customStatus.trim() || null,
            bio: bio.trim() || null,
            ...(user.isPlus ? { bannerColor, accentColor, hideLastSeen } : {}),
          })
        }
      >
        {t('settings.saveChanges')}
      </Button>

      <div className="h-px bg-divider" />

      <div className="flex items-start gap-3 rounded-lg bg-surface-secondary p-4">
        <Smartphone size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text-heading">{t('settings.downloadApp')}</p>
          <p className="mt-1 text-sm text-text-muted">{t('settings.downloadAppHint')}</p>
          {isInstalledAndroidApp() ? (
            <p className="mt-3 text-sm text-success">{t('settings.downloadAppInstalled')}</p>
          ) : (
            <a
              href={ANDROID_APK_PATH}
              download={ANDROID_APK_FILENAME}
              className="mt-3 inline-flex h-9 min-h-touch items-center justify-center gap-3 rounded bg-brand px-4 text-base font-medium text-white transition-colors hover:bg-brand-hover active:bg-brand-active md:min-h-0"
            >
              {t('settings.downloadApk')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
