import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { BottomSheet } from './BottomSheet';
import { Modal } from './Modal';

export interface AdaptiveDialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

/**
 * One dialog component for both layouts: a centred modal with a pointer, a
 * bottom sheet on touch. Every call site stays layout-agnostic.
 */
export function AdaptiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width,
}: AdaptiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={title}>
        <div className="px-3 pb-3">
          {description ? <p className="mb-3 text-base text-text-muted">{description}</p> : null}
          {children}
          {footer ? <div className="mt-4 flex flex-col-reverse gap-2">{footer}</div> : null}
        </div>
      </BottomSheet>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      width={width}
    >
      {children}
    </Modal>
  );
}
