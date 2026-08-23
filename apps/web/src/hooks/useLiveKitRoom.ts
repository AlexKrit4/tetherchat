import { useEffect, useRef } from 'react';
import type { Room } from 'livekit-client';
import { useCallStore } from '@/stores/callStore';

export function useLiveKitRoom(): void {
  const phase = useCallStore((state) => state.phase);
  const token = useCallStore((state) => state.token);
  const livekitUrl = useCallStore((state) => state.livekitUrl);
  const muted = useCallStore((state) => state.muted);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (phase !== 'active' || !token || !livekitUrl) return;

    let cancelled = false;
    let room: Room | null = null;

    void (async () => {
      const { Room: LiveKitRoom } = await import('livekit-client');
      room = new LiveKitRoom({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;
      await room.connect(livekitUrl, token);
      if (cancelled) {
        room.disconnect();
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(!muted);
    })().catch(() => {
      void useCallStore.getState().abandonCall();
    });

    return () => {
      cancelled = true;
      room?.disconnect();
      roomRef.current = null;
    };
  }, [phase, token, livekitUrl]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || phase !== 'active') return;
    void room.localParticipant.setMicrophoneEnabled(!muted);
  }, [muted, phase]);
}
