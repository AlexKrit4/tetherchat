import { useState } from 'react';
import { Bell, Ban, ChevronRight, LogOut, Palette, ShieldCheck, Sparkles, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MobileHeader } from './MobileHeader';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { BlacklistSettings } from '@/components/settings/BlacklistSettings';
import { PlusSettings } from '@/components/plus/PlusSettings';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

type Section = 'root' | 'profile' | 'account' | 'notifications' | 'appearance' | 'blocked' | 'plus';

/** Full-screen settings with a second level, instead of a desktop modal. */
export function MobileSettingsView() {
  const t = useT();
  const popMobileView = useUiStore((state) => state.popMobileView);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [section, setSection] = useState<Section>('root');

  const titles: Record<Exclude<Section, 'root'>, string> = {
    profile: t('settings.editProfile'),
    account: t('settings.accountSecurity'),
    notifications: t('settings.notifications'),
    appearance: t('settings.appearance'),
    blocked: t('settings.blockedUsers'),
    plus: t('settings.plus'),
  };

  if (section !== 'root') {
    return (
      <div className="flex h-full flex-col bg-surface">
        <MobileHeader title={titles[section]} onBack={() => setSection('root')} />
        <div className="scroller flex-1 px-4 pb-safe pt-3">
          {section === 'profile' ? <ProfileSettings /> : null}
          {section === 'account' ? <AccountSettings /> : null}
          {section === 'notifications' ? <NotificationSettings /> : null}
          {section === 'appearance' ? <AppearanceSettings /> : null}
          {section === 'blocked' ? <BlacklistSettings /> : null}
          {section === 'plus' ? <PlusSettings /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <MobileHeader title={t('settings.title')} onBack={popMobileView} />

      <div className="scroller flex-1 pb-safe">
        {user ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <Avatar user={user} size={56} showStatus />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-text-heading">
                {user.displayName ?? user.username}
              </p>
              <p className="truncate text-sm text-text-muted">@{user.username}</p>
            </div>
          </div>
        ) : null}

        <SettingsGroup label={t('settings.myAccount')}>
          <SettingsRow
            icon={User}
            label={t('settings.editProfile')}
            onSelect={() => setSection('profile')}
          />
          <SettingsRow
            icon={ShieldCheck}
            label={t('settings.accountSecurity')}
            onSelect={() => setSection('account')}
          />
        </SettingsGroup>

        <SettingsGroup label={t('settings.appSettings')}>
          <SettingsRow
            icon={Bell}
            label={t('settings.notifications')}
            onSelect={() => setSection('notifications')}
          />
          <SettingsRow
            icon={Palette}
            label={t('settings.appearance')}
            onSelect={() => setSection('appearance')}
          />
          <SettingsRow
            icon={Ban}
            label={t('settings.blockedUsers')}
            onSelect={() => setSection('blocked')}
          />
          <SettingsRow
            icon={Sparkles}
            label={t('settings.plus')}
            onSelect={() => setSection('plus')}
          />
        </SettingsGroup>

        <div className="px-4 py-6">
          <Button
            variant="danger"
            fullWidth
            size="lg"
            onClick={() => void logout()}
            className="justify-center"
          >
            <LogOut size={18} aria-hidden />
            {t('settings.logOut')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-[0.02em] text-text-muted">
        {label}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  onSelect,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-surface-hover',
        tone === 'danger' ? 'text-danger' : 'text-text',
      )}
    >
      <Icon size={20} className="shrink-0 text-text-muted" aria-hidden />
      <span className="flex-1 text-base">{label}</span>
      <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />
    </button>
  );
}
