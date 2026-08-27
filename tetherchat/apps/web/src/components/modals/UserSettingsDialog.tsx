import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { BlacklistSettings } from '@/components/settings/BlacklistSettings';
import { useAuthStore } from '@/stores/authStore';

type Tab = 'profile' | 'account' | 'notifications' | 'appearance' | 'blocked';

/** Desktop settings modal. Mobile uses the full-screen MobileSettingsView instead. */
export function UserSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('profile');
  const logout = useAuthStore((state) => state.logout);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: t('settings.profile') },
    { id: 'account', label: t('settings.account') },
    { id: 'notifications', label: t('settings.notifications') },
    { id: 'appearance', label: t('settings.appearance') },
    { id: 'blocked', label: t('settings.blockedUsers') },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')} width="lg">
      <div className="flex gap-6">
        <nav className="flex w-[180px] shrink-0 flex-col gap-0.5" aria-label={t('settings.sections')}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                'min-h-9 rounded px-2 text-left text-base transition-colors',
                tab === entry.id
                  ? 'bg-surface-selected text-text-heading'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text',
              )}
            >
              {entry.label}
            </button>
          ))}

          <div className="my-2 h-px bg-divider" />

          <Button variant="ghost" className="justify-start text-danger" onClick={() => void logout()}>
            <LogOut size={16} aria-hidden />
            {t('settings.logOut')}
          </Button>
        </nav>

        <div className="min-w-0 flex-1">
          {tab === 'profile' ? <ProfileSettings /> : null}
          {tab === 'account' ? <AccountSettings /> : null}
          {tab === 'notifications' ? <NotificationSettings /> : null}
          {tab === 'appearance' ? <AppearanceSettings /> : null}
          {tab === 'blocked' ? <BlacklistSettings /> : null}
        </div>
      </div>
    </Modal>
  );
}
