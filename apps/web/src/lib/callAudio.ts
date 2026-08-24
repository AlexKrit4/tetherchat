/** Keeps mic permission warm after an explicit user gesture (phone / accept click). */
let micReady = false;

export async function prepareCallMicrophone(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  if (micReady) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    stream.getTracks().forEach((track) => track.stop());
    micReady = true;
    return true;
  } catch {
    micReady = false;
    return false;
  }
}

export function resetCallMicrophone(): void {
  micReady = false;
}
