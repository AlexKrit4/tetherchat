/** Build-time theme slug. Set VITE_THEME=aurora for the preview mockup. */
export const appTheme = import.meta.env.VITE_THEME ?? 'classic';

export const isAuroraTheme = () => appTheme === 'aurora';

export const isPreviewBuild = () => isAuroraTheme();
