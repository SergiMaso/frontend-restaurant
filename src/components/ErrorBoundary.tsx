import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render errors anywhere below it and
 * shows a friendly fallback instead of crashing to a white screen.
 *
 * React Query / mutation errors are still handled via their own onError
 * hooks — this is only for synchronous render-time exceptions
 * (bad .map(), undefined access, throw inside a component, etc.).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] render error", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold text-destructive">Something went wrong</h1>
          <p className="text-muted-foreground">
            The dashboard hit an unexpected error and couldn't continue. Please reload the page.
            If the problem keeps happening, contact support.
          </p>
          {this.state.error && (
            <details className="text-left text-xs text-muted-foreground/70 bg-muted/30 p-3 rounded border border-border">
              <summary className="cursor-pointer">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error.name}: {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
