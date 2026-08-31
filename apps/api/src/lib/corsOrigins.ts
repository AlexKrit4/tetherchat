/** Origins allowed for the TetherChat desktop shell (Tauri WebView). */
export const DESKTOP_WEB_ORIGINS = [
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
] as const;

export function webCorsOrigins(publicWebOrigin: string): string[] {
  const configured = publicWebOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  return [...new Set([...configured, ...DESKTOP_WEB_ORIGINS])];
}
