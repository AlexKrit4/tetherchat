declare global {
  interface Window {
    __tetherchatNativeBackground?: boolean;
    __tetherchatOnBackground?: () => void;
    __tetherchatOnForeground?: () => void;
  }
}

let parked = false;
let nativeBackground = false;

export function isSessionParked(): boolean {
  return parked;
}

export function markSessionParked(value: boolean): void {
  parked = value;
}

export function markNativeBackground(value: boolean): void {
  nativeBackground = value;
  if (typeof window !== 'undefined') window.__tetherchatNativeBackground = value;
}

/** True when the tab/app is not in the foreground — used to show local notifications. */
export function isAppInBackground(): boolean {
  if (typeof document === 'undefined') return false;
  if (nativeBackground || parked) return true;
  if (typeof window !== 'undefined' && window.__tetherchatNativeBackground) return true;
  return document.visibilityState === 'hidden';
}
