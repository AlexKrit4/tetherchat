import { useMutation } from '@tanstack/react-query';
import type { SelfUser } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useLocale, useT } from '@/i18n/useT';
import { Toggle } from '@/components/ui/Toggle';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/useMediaQuery';

export function AppearanceSettings() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isMobile = useIsMobile();

  const save = useMutation({
    mutationFn: (input: { enterToSend: boolean }) => api.patch<SelfUser>('/api/users/@me', input),
    onSuccess: (updated) => setUser(updated),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-surface-secondary p-4">
        <p className="text-base font-semibold text-text-heading">{t('settings.theme')}</p>
        <p className="mt-1 text-sm text-text-muted">{t('settings.themeHint')}</p>
        <div className="mt-3 flex gap-2">
          <span className="flex items-center gap-2 rounded bg-surface-tertiary px-3 py-2 text-base text-text-heading ring-2 ring-brand">
            <span className="h-4 w-4 rounded-full bg-surface" aria-hidden />
            {t('settings.dark')}
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-surface-secondary p-4">
        <p className="text-base font-semibold text-text-heading">{t('common.language')}</p>
        <p className="mt-1 text-sm text-text-muted">{t('settings.languageHint')}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setLocale('ru')}
            className={cn(
              'flex items-center gap-2 rounded bg-surface-tertiary px-3 py-2 text-base text-text-heading',
              locale === 'ru' && 'ring-2 ring-brand',
            )}
          >
            {t('common.russian')}
          </button>
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={cn(
              'flex items-center gap-2 rounded bg-surface-tertiary px-3 py-2 text-base text-text-heading',
              locale === 'en' && 'ring-2 ring-brand',
            )}
          >
            {t('common.english')}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-surface-secondary p-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text-heading">{t('settings.enterToSend')}</p>
          <p className="mt-1 text-sm text-text-muted">
            {isMobile ? t('settings.enterToSendMobile') : t('settings.enterToSendDesktop')}
          </p>
        </div>
        <Toggle
          label={t('settings.enterToSend')}
          checked={user.enterToSend}
          disabled={isMobile}
          onChange={(next) => save.mutate({ enterToSend: next })}
        />
      </div>
    </div>
  );
}
