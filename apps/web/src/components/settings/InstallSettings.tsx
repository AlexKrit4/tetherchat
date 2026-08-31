import { useEffect, useState } from 'react';
import { Download, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { isInstalledAndroidApp } from '@/lib/androidApp';

type InstallPlatform = {
  versionName: string;
  versionCode?: number;
  url: string;
  filename: string;
};

type InstallDownloads = {
  android: InstallPlatform;
  windows: InstallPlatform;
  linuxAppImage: InstallPlatform;
  linuxDeb: InstallPlatform;
};

async function fetchInstallDownloads(): Promise<InstallDownloads> {
  const bust = Date.now();
  const response = await fetch(`/app/install.json?t=${bust}`);
  if (response.ok) return response.json() as Promise<InstallDownloads>;
  const fallback = await fetch('/api/app/install');
  if (!fallback.ok) throw new Error('install unavailable');
  return fallback.json() as Promise<InstallDownloads>;
}

/** Download links for Android, Windows and Linux native apps. */
export function InstallSettings() {
  const t = useT();
  const [data, setData] = useState<InstallDownloads | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchInstallDownloads()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-text-muted">{t('settings.installUnavailable')}</p>;
  }

  if (!data) {
    return <p className="text-sm text-text-muted">{t('common.loading')}</p>;
  }

  const hideAndroid = isInstalledAndroidApp();

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">{t('settings.installHint')}</p>

      {!hideAndroid ? (
        <InstallCard
          icon={Smartphone}
          title={t('settings.installAndroid')}
          version={data.android.versionName}
          hint={t('settings.installAndroidHint')}
          href={data.android.url}
          filename={data.android.filename}
          label={t('settings.downloadApk')}
        />
      ) : null}

      <InstallCard
        icon={Monitor}
        title={t('settings.installWindows')}
        version={data.windows.versionName}
        hint={t('settings.installWindowsHint')}
        href={data.windows.url}
        filename={data.windows.filename}
        label={t('settings.downloadExe')}
      />
      <InstallCard
        icon={Monitor}
        title={t('settings.installLinuxAppImage')}
        version={data.linuxAppImage.versionName}
        hint={t('settings.installLinuxAppImageHint')}
        href={data.linuxAppImage.url}
        filename={data.linuxAppImage.filename}
        label={t('settings.downloadAppImage')}
      />
      <InstallCard
        icon={Monitor}
        title={t('settings.installLinuxDeb')}
        version={data.linuxDeb.versionName}
        hint={t('settings.installLinuxDebHint')}
        href={data.linuxDeb.url}
        filename={data.linuxDeb.filename}
        label={t('settings.downloadDeb')}
      />
    </div>
  );
}

function InstallCard({
  icon: Icon,
  title,
  version,
  hint,
  href,
  filename,
  label,
}: {
  icon: typeof Smartphone;
  title: string;
  version: string;
  hint: string;
  href: string;
  filename: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-surface-secondary p-4">
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-text-heading">{title}</p>
            <span className="rounded bg-surface-tertiary px-2 py-0.5 text-xs text-text-muted">v{version}</span>
          </div>
          <p className="mt-1 text-sm text-text-muted">{hint}</p>
          <a
            href={href}
            download={filename}
            className={cn(
              'mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white',
              'hover:bg-brand-hover active:bg-brand-active',
            )}
          >
            <Download size={16} aria-hidden />
            {label}
          </a>
        </div>
      </div>
    </div>
  );
}
