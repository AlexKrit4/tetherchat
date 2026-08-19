import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleX, Mic, Paperclip, Pause, Play, Plus, SendHorizonal, SmilePlus, Trash2, X } from 'lucide-react';
import { LIMITS, Permission, can } from '@tetherchat/shared';
import type { Attachment, Message } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAutoResize } from '@/hooks/useAutoResize';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useMembers } from '@/hooks/useServers';
import { useNonce, useSendMessage, useUploadAttachment } from '@/hooks/useMessages';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { EmojiPicker } from './EmojiPicker';
import { MentionAutocomplete, detectMentionQuery } from './MentionAutocomplete';
import type { MentionQuery } from './MentionAutocomplete';
import { TypingIndicator } from './TypingIndicator';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { toast } from '@/stores/toastStore';
import { useT } from '@/i18n/useT';
import { formatBytes } from './Attachments';

const TYPING_THROTTLE_MS = 3_000;

/**
 * The composer. One component for both layouts: on desktop Enter sends and the
 * send button is hidden; on touch Enter inserts a newline and an explicit send
 * button appears, because on-screen keyboards have no reliable Shift+Enter.
 */
export function MessageInput() {
  const t = useT();
  const isMobile = useIsMobile();
  const { channelId, isDm, server, title, serverId } = useChatTarget();
  const user = useAuthStore((state) => state.user);
  const { data: members } = useMembers(serverId);

  const draft = useUiStore((state) => (channelId ? state.drafts[channelId] ?? '' : ''));
  const setDraft = useUiStore((state) => state.setDraft);
  const replyTo = useUiStore((state) => (channelId ? state.replyDrafts[channelId] : undefined));
  const setReplyDraft = useUiStore((state) => state.setReplyDraft);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentAt = useRef(0);

  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [voicePreview, setVoicePreview] = useState<VoicePreview | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const recordStartedAt = useRef(0);
  const recordTimer = useRef<number>(0);
  const recordStream = useRef<MediaStream | null>(null);
  const recordSamples = useRef<number[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const holdingMic = useRef(false);

  const nonce = useNonce();
  const send = useSendMessage(channelId ?? '', isDm);
  const upload = useUploadAttachment();
  const nudgeScrollBottom = useUiStore((state) => state.nudgeScrollBottom);

  const maxHeight = isMobile ? 120 : 350;
  useAutoResize(textareaRef, draft, maxHeight);

  const canSend = isDm || !server || can(server.permissions, Permission.SEND_MESSAGES);
  const canAttach = isDm || !server || can(server.permissions, Permission.ATTACH_FILES);
  const enterToSend = isMobile ? false : (user?.enterToSend ?? true);

  // Focus the composer when the user starts typing anywhere on desktop.
  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      textareaRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile]);

  useEffect(() => {
    setPending([]);
    setMentionQuery(null);
  }, [channelId]);

  const emitTyping = () => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastTypingSentAt.current < TYPING_THROTTLE_MS) return;
    lastTypingSentAt.current = now;
    const socket = getSocket();
    if (socket.connected) socket.emit('typing:start', { channelId });
  };

  const stopTyping = () => {
    if (!channelId) return;
    lastTypingSentAt.current = 0;
    const socket = getSocket();
    if (socket.connected) socket.emit('typing:stop', { channelId });
  };

  const keepComposerFocused = () => {
    textareaRef.current?.focus({ preventScroll: true });
  };

  const sendVoice = async (blob: Blob, durationMs: number) => {
    if (!channelId || durationMs < 400) return;
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([blob], `voice.${extension}`, { type: blob.type || 'audio/webm' });
    try {
      const attachment = await upload.mutateAsync({ file, durationMs });
      send.mutate({
        content: '',
        attachmentIds: [attachment.id],
        attachmentDurations: { [attachment.id]: durationMs },
        nonce: nonce(),
      });
      nudgeScrollBottom();
    } catch (error) {
      toast.error(errorMessage(error, t('chat.voiceFailed')));
    }
  };

  const releaseMedia = () => {
    recordStream.current?.getTracks().forEach((track) => track.stop());
    recordStream.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const discardVoicePreview = () => {
    const current = voicePreview;
    if (current) URL.revokeObjectURL(current.url);
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setVoicePreview(null);
    setPreviewPlaying(false);
  };

  const stopRecording = (keepClip: boolean) => {
    const recorder = recorderRef.current;
    holdingMic.current = false;
    if (!recorder) {
      releaseMedia();
      window.clearInterval(recordTimer.current);
      setRecording(false);
      setRecordMs(0);
      return;
    }
    recorder.onstop = () => {
      const durationMs = Date.now() - recordStartedAt.current;
      const blob = new Blob(recordChunks.current, { type: recorder.mimeType || 'audio/webm' });
      const samples = recordSamples.current.slice();
      recordChunks.current = [];
      recordSamples.current = [];
      releaseMedia();
      recorderRef.current = null;
      window.clearInterval(recordTimer.current);
      setRecording(false);
      setRecordMs(0);
      if (!keepClip || durationMs < 400 || blob.size === 0) return;
      const url = URL.createObjectURL(blob);
      setVoicePreview({ blob, url, durationMs, samples });
    };
    if (recorder.state !== 'inactive') recorder.stop();
  };

  const startRecording = async () => {
    if (!canAttach || recording || voicePreview) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!holdingMic.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recordChunks.current = [];
      recordSamples.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunks.current.push(event.data);
      };
      const audioCtx = new AudioContext();
      await audioCtx.resume();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      const timeDomain = new Uint8Array(analyser.fftSize);
      recorder.start();
      recorderRef.current = recorder;
      recordStream.current = stream;
      recordStartedAt.current = Date.now();
      setRecording(true);
      setRecordMs(0);
      recordTimer.current = window.setInterval(() => {
        setRecordMs(Date.now() - recordStartedAt.current);
        const node = analyserRef.current;
        if (!node) return;
        node.getByteTimeDomainData(timeDomain);
        let peak = 0;
        for (const value of timeDomain) peak = Math.max(peak, Math.abs(value - 128));
        if (recordSamples.current.length < 400) {
          recordSamples.current.push(Math.max(0.08, peak / 128));
        }
      }, 80);
    } catch {
      holdingMic.current = false;
      toast.error(t('chat.micDenied'));
    }
  };

  const sendVoicePreview = () => {
    if (!voicePreview) return;
    const { blob, durationMs, url } = voicePreview;
    setVoicePreview(null);
    setPreviewPlaying(false);
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    URL.revokeObjectURL(url);
    void sendVoice(blob, durationMs);
  };

  const togglePreviewPlayback = () => {
    if (!voicePreview) return;
    let audio = previewAudioRef.current;
    if (!audio) {
      audio = new Audio(voicePreview.url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewPlaying(false);
    }
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
    } else {
      void audio.play();
      setPreviewPlaying(true);
    }
  };

  useEffect(() => {
    discardVoicePreview();
    if (holdingMic.current || recorderRef.current) stopRecording(false);
  }, [channelId]);

  const submit = () => {
    if (!channelId) return;
    const content = draft.trim();
    if (content.length === 0 && pending.length === 0) return;
    if (content.length > LIMITS.messageContent.max) {
      toast.error(t('chat.tooLong', { max: LIMITS.messageContent.max }));
      return;
    }

    send.mutate({
      content,
      replyToId: replyTo?.id ?? null,
      attachmentIds: pending.map((attachment) => attachment.id),
      nonce: nonce(),
    });

    setDraft(channelId, '');
    setReplyDraft(channelId, null);
    setPending([]);
    setMentionQuery(null);
    stopTyping();
    keepComposerFocused();
    nudgeScrollBottom();
  };

  const applyMention = (replacement: { text: string; start: number; length: number }) => {
    if (!channelId) return;
    const next =
      draft.slice(0, replacement.start) +
      replacement.text +
      draft.slice(replacement.start + replacement.length);
    setDraft(channelId, next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      const caret = replacement.start + replacement.text.length;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  };

  const attachFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, LIMITS.attachmentsPerMessage - pending.length);
    for (const file of list) {
      if (file.size > LIMITS.attachmentBytes) {
        toast.error(t('chat.fileTooBig', { name: file.name, size: formatBytes(LIMITS.attachmentBytes) }));
        continue;
      }
      try {
        const attachment = await upload.mutateAsync(file);
        setPending((current) => [...current, attachment]);
      } catch (error) {
        toast.error(errorMessage(error, t('chat.uploadFailed', { name: file.name })));
      }
    }
  };

  const placeholder = channelId
    ? isDm
      ? t('chat.messageUser', { name: title })
      : t('chat.messageChannel', { name: title })
    : t('chat.selectChannel');

  const mentionMembers = useMemo(() => members ?? [], [members]);

  if (!channelId) return null;

  return (
    <div className={cn('relative shrink-0 px-4 pb-2 md:pb-6', isMobile && 'pb-safe')}>
      {replyTo ? <ReplyBar message={replyTo} onCancel={() => setReplyDraft(channelId, null)} /> : null}

      {pending.length > 0 ? (
        <div className="mb-1 flex flex-wrap gap-2 rounded-t-lg bg-surface-input p-2">
          {pending.map((attachment) => (
            <div
              key={attachment.id}
              className="relative flex w-[120px] flex-col gap-1 rounded bg-surface-secondary p-2"
            >
              {attachment.contentType.startsWith('image/') ? (
                <img
                  src={attachment.url}
                  alt=""
                  className="h-16 w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <Paperclip size={20} className="text-text-muted" aria-hidden />
              )}
              <span className="truncate text-2xs text-text-muted">{attachment.filename}</span>
              <button
                type="button"
                aria-label={t('chat.removeFile', { name: attachment.filename })}
                onClick={() =>
                  setPending((current) => current.filter((item) => item.id !== attachment.id))
                }
                className="absolute -right-1.5 -top-1.5 rounded-full bg-surface-floating text-text-muted hover:text-danger"
              >
                <CircleX size={18} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {mentionQuery ? (
        <MentionAutocomplete
          query={mentionQuery}
          members={mentionMembers}
          channels={server?.channels ?? []}
          onPick={applyMention}
          onDismiss={() => setMentionQuery(null)}
        />
      ) : null}

      {recording ? (
        <div className="mb-1 flex justify-center" aria-live="polite">
          <span className="rounded-md bg-surface-floating px-2 py-0.5 text-xs font-semibold tabular-nums text-danger shadow-floating">
            {formatVoiceClock(recordMs)}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex items-end gap-1 rounded-lg bg-surface-input',
          isMobile ? 'px-1 py-1' : 'px-4 py-0.5',
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (canAttach && event.dataTransfer.files.length > 0) {
            void attachFiles(event.dataTransfer.files);
          }
        }}
      >
        <IconButton
          icon={Plus}
          label={t('chat.attach')}
          size={isMobile ? 'lg' : 'md'}
          disabled={!canAttach || pending.length >= LIMITS.attachmentsPerMessage}
          onClick={() => fileInputRef.current?.click()}
          className={cn('self-end', isMobile ? 'mb-0' : 'mb-1.5')}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void attachFiles(event.target.files);
            event.target.value = '';
          }}
        />

        {voicePreview ? (
          <VoicePreviewBar
            preview={voicePreview}
            playing={previewPlaying}
            onTogglePlay={togglePreviewPlayback}
            onDiscard={discardVoicePreview}
          />
        ) : (
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            disabled={!canSend}
            placeholder={canSend ? placeholder : t('chat.noPermission')}
            inputMode="text"
            enterKeyHint={enterToSend ? 'send' : 'enter'}
            aria-label={placeholder}
            onChange={(event) => {
              setDraft(channelId, event.target.value);
              setMentionQuery(
                detectMentionQuery(event.target.value, event.target.selectionStart ?? 0),
              );
              if (event.target.value.length > 0) emitTyping();
              else stopTyping();
            }}
            onBlur={stopTyping}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files);
              if (canAttach && files.length > 0) {
                event.preventDefault();
                void attachFiles(files);
              }
            }}
            onKeyDown={(event) => {
              if (mentionQuery && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key)) return;
              if (event.key === 'Enter' && enterToSend && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className={cn(
              'min-w-0 flex-1 resize-none bg-transparent text-message text-text outline-none',
              'placeholder:text-text-faint',
              isMobile
                ? 'max-h-[120px] min-h-touch py-3 pl-1 pr-1 text-message-mobile'
                : 'max-h-[350px] py-3',
            )}
          />
        )}

        <div className={cn('flex shrink-0 items-center gap-0.5 self-end', isMobile ? '' : 'mb-1.5')}>
          <div className="relative">
            <IconButton
              icon={SmilePlus}
              label={t('chat.emoji')}
              size={isMobile ? 'lg' : 'md'}
              onClick={() => setEmojiOpen(true)}
            />
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onSelect={(emoji) => setDraft(channelId, draft + emoji)}
            />
          </div>

          {/* Hold the mic to record; release opens a preview instead of sending. */}
          {voicePreview ? (
            <IconButton
              icon={SendHorizonal}
              label={t('chat.voiceSend')}
              size={isMobile ? 'lg' : 'md'}
              showTooltip={false}
              disabled={!canSend}
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={sendVoicePreview}
              className="text-brand disabled:text-text-faint"
            />
          ) : draft.trim().length === 0 && pending.length === 0 && canAttach ? (
            <button
              type="button"
              aria-label={t('chat.voice')}
              disabled={!canSend}
              onPointerDown={(event) => {
                event.preventDefault();
                holdingMic.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                void startRecording();
              }}
              onPointerUp={(event) => {
                holdingMic.current = false;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                stopRecording(true);
              }}
              onPointerCancel={() => {
                holdingMic.current = false;
                stopRecording(true);
              }}
              onContextMenu={(event) => event.preventDefault()}
              style={{ touchAction: 'none' }}
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded text-text-subheading hover:text-text-heading',
                isMobile ? 'h-touch w-touch' : 'mb-1.5 h-8 w-8',
                recording && 'text-danger',
              )}
            >
              <Mic size={isMobile ? 22 : 20} strokeWidth={1.75} aria-hidden />
            </button>
          ) : isMobile || draft.trim().length > 0 || pending.length > 0 ? (
            <IconButton
              icon={SendHorizonal}
              label={t('chat.send')}
              size={isMobile ? 'lg' : 'md'}
              showTooltip={false}
              disabled={!canSend || (draft.trim().length === 0 && pending.length === 0)}
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={submit}
              className="text-brand disabled:text-text-faint"
            />
          ) : null}
        </div>
      </div>

      <TypingIndicator channelId={channelId} />
    </div>
  );
}

type VoicePreview = {
  blob: Blob;
  url: string;
  durationMs: number;
  samples: number[];
};

function formatVoiceClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function downsampleWaveform(samples: number[], bars: number): number[] {
  if (samples.length === 0) return Array.from({ length: bars }, () => 0.2);
  if (samples.length <= bars) return samples;
  const bucket = samples.length / bars;
  return Array.from({ length: bars }, (_, index) => {
    const start = Math.floor(index * bucket);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucket));
    let peak = 0.08;
    for (let i = start; i < end && i < samples.length; i += 1) peak = Math.max(peak, samples[i] ?? 0);
    return peak;
  });
}

function VoicePreviewBar({
  preview,
  playing,
  onTogglePlay,
  onDiscard,
}: {
  preview: VoicePreview;
  playing: boolean;
  onTogglePlay: () => void;
  onDiscard: () => void;
}) {
  const t = useT();
  const bars = downsampleWaveform(preview.samples, 40);
  return (
    <div className="flex min-h-touch min-w-0 flex-1 items-center gap-1 py-1">
      <button
        type="button"
        aria-label={playing ? t('chat.voicePause') : t('chat.voicePlay')}
        onClick={onTogglePlay}
        className="flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-brand"
      >
        {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
      </button>
      <div className="flex h-8 min-w-0 flex-1 items-center gap-px" aria-hidden>
        {bars.map((value, index) => (
          <span
            key={index}
            className="w-[3px] shrink-0 rounded-full bg-brand"
            style={{ height: `${Math.max(18, value * 100)}%` }}
          />
        ))}
      </div>
      <span className="shrink-0 px-1 text-2xs tabular-nums text-text-muted">
        {formatVoiceClock(preview.durationMs)}
      </span>
      <button
        type="button"
        aria-label={t('chat.voiceDelete')}
        onClick={onDiscard}
        className="flex h-touch w-touch shrink-0 items-center justify-center rounded text-danger"
      >
        <Trash2 size={18} aria-hidden />
      </button>
    </div>
  );
}

function ReplyBar({ message, onCancel }: { message: Message; onCancel: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 rounded-t-lg bg-surface-secondary px-3 py-1.5 text-sm text-text-muted">
      <Avatar user={message.author} size={18} />
      <span className="shrink-0">{t('chat.replyTo')}</span>
      <span className="truncate font-medium text-text-subheading">
        {message.author.displayName ?? message.author.username}
      </span>
      <button
        type="button"
        aria-label={t('chat.cancelReply')}
        onClick={onCancel}
        className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:text-text-heading"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
