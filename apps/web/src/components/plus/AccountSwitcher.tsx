import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { loadAccounts } from '@/lib/accounts';
import { usePlusStore } from '@/stores/plusStore';
import { useT } from '@/i18n/useT';
import { Tooltip } from '@/components/ui/Tooltip';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { errorMessage } from '@/lib/api';
import { toast } from '@/stores/toastStore';

export function AccountSwitcher() {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const switchAccount = useAuthStore((state) => state.switchAccount);
  const addAccount = useAuthStore((state) => state.addAccount);
  const showPlus = usePlusStore((state) => state.show);
  const other = loadAccounts().other;
  const [addOpen, setAddOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const onAdd = async () => {
    if (!user.isPlus) {
      showPlus('accounts');
      return;
    }
    if (other) {
      toast.error(t('plus.accountsFull'));
      return;
    }
    setAddOpen(true);
  };

  const submitAdd = async () => {
    setBusy(true);
    try {
      await addAccount(login, password);
      setAddOpen(false);
      setLogin('');
      setPassword('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 pb-3 pt-1">
      {other ? (
        <Tooltip content={other.user.displayName ?? other.user.username} placement="right">
          <button
            type="button"
            onClick={() => void switchAccount()}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-secondary ring-2 ring-transparent hover:ring-brand"
            aria-label={t('plus.switchAccount')}
          >
            <Avatar
              user={{
                id: other.user.id,
                username: other.user.username,
                displayName: other.user.displayName,
                avatarUrl: other.user.avatarUrl,
                status: 'offline',
              }}
              size={40}
            />
          </button>
        </Tooltip>
      ) : (
        <Tooltip content={t('plus.addAccount')} placement="right">
          <button
            type="button"
            onClick={() => void onAdd()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary text-text-muted hover:bg-brand hover:text-white"
            aria-label={t('plus.addAccount')}
          >
            <Plus size={18} aria-hidden />
          </button>
        </Tooltip>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('plus.addAccount')} width="sm">
        <div className="flex flex-col gap-3">
          <Input label={t('auth.loginIdentifier')} value={login} onChange={(event) => setLogin(event.target.value)} />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button loading={busy} onClick={() => void submitAdd()}>
            {t('auth.logIn')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
