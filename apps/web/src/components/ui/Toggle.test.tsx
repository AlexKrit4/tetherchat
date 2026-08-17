import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toggle } from './Toggle';
import { IconButton } from './IconButton';
import { Bell } from 'lucide-react';
import { setViewport } from '@/test/setup';

describe('Toggle', () => {
  it('exposes switch semantics and reports changes', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Push notifications" />);

    const toggle = screen.getByRole('switch', { name: 'Push notifications' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ignores clicks when disabled', async () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="Muted" disabled />);

    await userEvent.click(screen.getByRole('switch', { name: 'Muted' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('keeps a 44px target at the large size used on touch layouts', () => {
    setViewport(390);
    render(<IconButton icon={Bell} label="Notifications" size="lg" />);

    const button = screen.getByRole('button', { name: 'Notifications' });
    expect(button.className).toContain('h-touch');
    expect(button.className).toContain('w-touch');
  });

  it('labels itself for assistive tech even without a tooltip', () => {
    render(<IconButton icon={Bell} label="Notifications" showTooltip={false} />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });
});
