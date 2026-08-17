import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface State {
  error: Error | null;
}

/** Keeps a render crash from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[tetherchat] render error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen-dvh flex-col items-center justify-center gap-4 bg-base-tertiary px-6 text-center">
        <h1 className="text-2xl font-bold text-text-heading">Something broke</h1>
        <p className="max-w-[420px] text-base text-text-muted">
          TetherChat hit an unexpected error. Reloading usually clears it.
        </p>
        <pre className="max-w-full overflow-x-auto rounded bg-base-secondary p-3 text-left text-sm text-text-muted">
          {error.message}
        </pre>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
