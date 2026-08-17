import { cloneElement, useId, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useHasHover } from '@/hooks/useMediaQuery';

type Placement = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  content: ReactNode;
  placement?: Placement;
  children: ReactElement;
  delay?: number;
}

const OFFSET = 8;

/**
 * Hover-only affordance: on touch devices it renders nothing but the child, so
 * no tooltip can ever get stuck on screen after a tap.
 */
export function Tooltip({ content, placement = 'top', children, delay = 120 }: TooltipProps) {
  const hasHover = useHasHover();
  const id = useId();
  const timer = useRef<number | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  if (!hasHover || !content) return children;

  const show = (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    const target = event.currentTarget.getBoundingClientRect();
    timer.current = window.setTimeout(() => {
      const coordinates = {
        top:
          placement === 'top'
            ? target.top - OFFSET
            : placement === 'bottom'
              ? target.bottom + OFFSET
              : target.top + target.height / 2,
        left:
          placement === 'right'
            ? target.right + OFFSET
            : placement === 'left'
              ? target.left - OFFSET
              : target.left + target.width / 2,
      };
      setPosition(coordinates);
    }, delay);
  };

  const hide = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setPosition(null);
  };

  const translate: Record<Placement, string> = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  };

  return (
    <>
      {cloneElement(children, {
        'aria-describedby': position ? id : undefined,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      } as Partial<React.HTMLAttributes<HTMLElement>>)}

      {position
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              style={{ top: position.top, left: position.left, transform: translate[placement] }}
              className={cn(
                'pointer-events-none fixed z-[100] max-w-[240px] animate-fade-in',
                'rounded bg-base-floating px-2 py-1.5 text-sm font-medium text-text-heading shadow-floating',
              )}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
