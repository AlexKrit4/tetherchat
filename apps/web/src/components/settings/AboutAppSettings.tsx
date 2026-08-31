import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Info, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT, useLocale } from '@/i18n/useT';
import { ANDROID_APK_FILENAME, ANDROID_APK_PATH } from '@/lib/androidApp';

type VersionHistoryEntry = {
  versionCode: number;
  versionName: string;
  releaseNotes: string;
  releasedAt: string;
  requiresReinstall?: boolean;
};

type VersionHistoryResponse = {
  creator: string;
  history: VersionHistoryEntry[];
};

type View = 'main' | 'history' | 'detail';

function formatReleaseDate(raw: string, locale: string): string {
  const date = raw.slice(0, 10);
  if (!date) return '';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

async function fetchVersionHistory(): Promise<VersionHistoryResponse> {
  const bust = Date.now();
  const response = await fetch(`/app/version-history.json?t=${bust}`);
  if (response.ok) return response.json() as Promise<VersionHistoryResponse>;
  const fallback = await fetch('/api/app/android/history');
  if (!fallback.ok) throw new Error('history unavailable');
  return fallback.json() as Promise<VersionHistoryResponse>;
}

/** About screen with nested version history for settings. */
export function AboutAppSettings() {
  const t = useT();
  const { locale } = useLocale();
  const [view, setView] = useState<View>('main');
  const [creator, setCreator] = useState('alexkrit');
  const [history, setHistory] = useState<VersionHistoryEntry[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [selected, setSelected] = useState<VersionHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [releaseResponse, historyResponse] = await Promise.all([
          fetch(`/app/version.json?t=${Date.now()}`),
          fetchVersionHistory(),
        ]);
        if (cancelled) return;
        if (releaseResponse.ok) {
          const release = (await releaseResponse.json()) as { versionName?: string };
          setCurrentVersion(release.versionName ?? null);
        }
        setCreator(historyResponse.creator || 'alexkrit');
        setHistory(historyResponse.history);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view === 'detail' && selected) {
    const isCurrent = currentVersion === selected.versionName;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setView('history')}
          className="inline-flex min-h-9 items-center gap-1 text-sm text-brand hover:underline"
        >
          <ChevronLeft size={16} aria-hidden />
          {t('settings.versionHistory')}
        </button>
        <div className="rounded-xl bg-surface-secondary p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-text-heading">
              {isCurrent ? t('settings.currentVersion') : t('settings.versionLabel', { version: selected.versionName })}
            </h3>
            {isCurrent ? (
              <span className="rounded bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
                {t('settings.currentBadge')}
              </span>
            ) : null}
          </div>
          {selected.releasedAt ? (
            <p className="mt-1 text-sm text-text-muted">{formatReleaseDate(selected.releasedAt, locale)}</p>
          ) : null}
          {selected.requiresReinstall ? (
            <p className="mt-2 text-sm text-danger">{t('settings.requiresReinstall')}</p>
          ) : null}
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('settings.whatsNew')}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-text">
            {selected.releaseNotes || t('settings.noReleaseNotes')}
          </p>
        </div>
      </div>
    );
  }

  if (view === 'history') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setView('main')}
          className="inline-flex min-h-9 items-center gap-1 text-sm text-brand hover:underline"
        >
          <ChevronLeft size={16} aria-hidden />
          {t('settings.aboutApp')}
        </button>
        {loading ? (
          <p className="text-sm text-text-muted">{t('common.loading')}</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => {
              const isCurrent = currentVersion === entry.versionName;
              return (
                <button
                  key={entry.versionCode}
                  type="button"
                  onClick={() => {
                    setSelected(entry);
                    setView('detail');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl bg-surface-secondary px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text-heading">{entry.versionName}</span>
                      {isCurrent ? (
                        <span className="rounded bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
                          {t('settings.currentBadge')}
                        </span>
                      ) : null}
                    </div>
                    {entry.releasedAt ? (
                      <p className="text-sm text-text-muted">{formatReleaseDate(entry.releasedAt, locale)}</p>
                    ) : null}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-secondary p-5 text-center">
        <p className="text-2xl font-bold text-text-heading">TetherChat</p>
        <p className="mt-2 text-base text-text">
          {currentVersion
            ? t('settings.androidVersion', { version: currentVersion })
            : t('settings.androidVersionUnknown')}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-surface-secondary p-4">
        <User size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div>
          <p className="text-sm text-text-muted">{t('settings.creator')}</p>
          <p className="text-base font-medium text-text-heading">{creator}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setView('history')}
        className="flex w-full items-center gap-3 rounded-xl bg-surface-secondary px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <History size={20} className="shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-heading">{t('settings.versionHistory')}</p>
          <p className="text-sm text-text-muted">{t('settings.versionHistoryHint')}</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />
      </button>

      <div className="flex items-start gap-3 rounded-xl bg-surface-secondary p-4">
        <Info size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text-heading">{t('settings.downloadApp')}</p>
          <p className="mt-1 text-sm text-text-muted">{t('settings.downloadAppHint')}</p>
          <a
            href={ANDROID_APK_PATH}
            download={ANDROID_APK_FILENAME}
            className={cn(
              'mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white',
              'hover:bg-brand-hover',
            )}
          >
            {t('settings.downloadApk')}
          </a>
        </div>
      </div>
    </div>
  );
}
