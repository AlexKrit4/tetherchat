/**
 * Build-time theme slug, fixed for the lifetime of a bundle: each look is
 * deployed as its own container on its own port rather than toggled at runtime,
 * so this never changes after startup and callers can treat it as a constant.
 */
export type AppTheme = 'classic' | 'aurora' | 'graphite';

const THEMES: readonly AppTheme[] = ['classic', 'aurora', 'graphite'];

const requested = import.meta.env.VITE_THEME;

export const appTheme: AppTheme = THEMES.includes(requested as AppTheme)
  ? (requested as AppTheme)
  : 'classic';

export const isAuroraTheme = () => appTheme === 'aurora';

export const isGraphite = () => appTheme === 'graphite';

/** True for the mockup builds, which show a badge and a distinct title. */
export const isPreviewBuild = () => appTheme !== 'classic';

/** Colour of the browser chrome, matching each theme's deepest surface. */
export const themeColor: Record<AppTheme, string> = {
  classic: '#1e1f22',
  aurora: '#080910',
  graphite: '#08090a',
};

export const themeTitle: Record<AppTheme, string> = {
  classic: 'TetherChat',
  aurora: 'TetherChat Aurora (макет)',
  graphite: 'TetherChat Graphite (макет)',
};
