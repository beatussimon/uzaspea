import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NetworkErrorState from './NetworkErrorState';
import { ClassifiedError } from '../../utils/errorUtils';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

describe('NetworkErrorState', () => {
  it('renders explicit "It\'s not you!" badge and error information', () => {
    const error: ClassifiedError = {
      type: 'offline',
      isNetworkOrServer: true,
      canRetry: true,
      titleKey: 'error_network_title',
      descKey: 'error_network_desc',
      defaultTitle: 'Connection Problem',
      defaultDesc: "It's not you! We couldn't connect to SokoniMax.",
    };

    render(<NetworkErrorState error={error} />);

    expect(screen.getByText("It's not you!")).toBeInTheDocument();
    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    expect(screen.getByText("It's not you! We couldn't connect to SokoniMax.")).toBeInTheDocument();
  });

  it('triggers onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    const error: ClassifiedError = {
      type: 'server',
      isNetworkOrServer: true,
      canRetry: true,
      statusCode: 500,
      titleKey: 'error_server_title',
      descKey: 'error_server_desc',
      defaultTitle: 'Server Problem',
      defaultDesc: "It's not you! Our servers are experiencing issues.",
    };

    render(<NetworkErrorState error={error} onRetry={onRetry} />);

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders compact mode correctly with badge and retry', () => {
    const onRetry = vi.fn();
    const error: ClassifiedError = {
      type: 'offline',
      isNetworkOrServer: true,
      canRetry: true,
      titleKey: 'error_network_title',
      descKey: 'error_network_desc',
      defaultTitle: 'Connection Problem',
      defaultDesc: "It's not you! Check your internet.",
    };

    render(<NetworkErrorState error={error} onRetry={onRetry} compact={true} />);

    expect(screen.getByText("It's not you!")).toBeInTheDocument();
    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
