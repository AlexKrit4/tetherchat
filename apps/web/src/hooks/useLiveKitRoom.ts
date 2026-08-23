import { useEffect, useRef } from 'react';
import type { RemoteTrack, Room } from 'livekit-client';
import { useCallStore } from '@/stores/callStore';

function attachRemoteAudio(track: RemoteTrack): void {
  if (track.kind !== 'audio') return;
  const element = track.attach();
  element.autoplay = true;
  element.setAttribute('playsinline', 'true');
  void element.play().catch(() => undefined);
}

export function useLiveKitRoom(): void {
  const phase = useCallStore((state) => state.phase);
  const token = useCallStore((state) => state.token);
  const livekitUrl = useCallStore((state) => state.livekitUrl);
  const muted = useCallStore((state) => state.muted);
  const setNeedsAudioUnlock = useCallStore((state) => state.setNeedsAudioUnlock);
  const setUnlockRemoteAudio = useCallStore((state) => state.setUnlockRemoteAudio);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (phase !== 'active' || !token || !livekitUrl) return;

    let cancelled = false;
    let room: Room | null = null;

    void (async () => {
      const { Room: LiveKitRoom, RoomEvent, Track } = await import('livekit-client');
      room = new LiveKitRoom({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      roomRef.current = room;

      const syncPlaybackGate = () => {
        if (!room) return;
        setNeedsAudioUnlock(!room.canPlaybackAudio);
        setUnlockRemoteAudio(async () => {
          if (!room) return;
          await room.startAudio();
          setNeedsAudioUnlock(!room.canPlaybackAudio);
        });
      };

      room.on(RoomEvent.AudioPlaybackStatusChanged, syncPlaybackGate);
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        attachRemoteAudio(track);
      });

      await room.connect(livekitUrl, token);
      if (cancelled) {
        room.disconnect();
        return;
      }

      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
          if (publication.track) attachRemoteAudio(publication.track);
        }
      }

      await room.localParticipant.setMicrophoneEnabled(!muted);
      await room.startAudio().catch(() => undefined);
      syncPlaybackGate();
    })().catch(() => {
      void useCallStore.getState().abandonCall();
    });

    return () => {
      cancelled = true;
      setNeedsAudioUnlock(false);
      setUnlockRemoteAudio(null);
      room?.disconnect();
      roomRef.current = null;
    };
  }, [phase, token, livekitUrl, setNeedsAudioUnlock, setUnlockRemoteAudio]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || phase !== 'active') return;
    void room.localParticipant.setMicrophoneEnabled(!muted);
  }, [muted, phase]);
}
