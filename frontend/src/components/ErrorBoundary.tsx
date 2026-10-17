import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300">
            Something went wrong. Please reload or return to the home page.{' '}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="underline font-medium text-neutral-900 dark:text-white hover:opacity-80 cursor-pointer"
            >
              Reload
            </button>
            {' · '}
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="underline font-medium text-neutral-900 dark:text-white hover:opacity-80 cursor-pointer"
            >
              Back to Home
            </button>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

