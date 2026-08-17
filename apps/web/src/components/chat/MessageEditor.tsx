import { useEffect, useRef, useState } from 'react';
import { useAutoResize } from '@/hooks/useAutoResize';

export interface MessageEditorProps {
  initialValue: string;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}

/** Inline editor shown in place of a message body while editing. */
export function MessageEditor({ initialValue, onSubmit, onCancel }: MessageEditorProps) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoResize(ref, value, 400);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <textarea
        ref={ref}
        value={value}
        rows={1}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const trimmed = value.trim();
            if (trimmed) onSubmit(trimmed);
          }
        }}
        className="w-full resize-none rounded-lg bg-surface-input px-3 py-2.5 text-message text-text outline-none"
      />
      <p className="text-xs text-text-muted">
        escape to{' '}
        <button type="button" onClick={onCancel} className="text-text-link hover:underline">
          cancel
        </button>{' '}
        · enter to{' '}
        <button
          type="button"
          onClick={() => value.trim() && onSubmit(value.trim())}
          className="text-text-link hover:underline"
        >
          save
        </button>
      </p>
    </div>
  );
}
