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
  it('renders plain text error information without badges or cards', () => {
    const error: ClassifiedError = {
      type: 'offline',
      isNetworkOrServer: true,
      canRetry: true,
      titleKey: 'error_network_title',
      descKey: 'error_network_desc',
      defaultTitle: 'Network issue',
      defaultDesc: 'There is a network issue. Please check your internet connection.',
    };

    render(<NetworkErrorState error={error} />);

    expect(screen.getByText(/There is a network issue\. Please check your internet connection\./)).toBeInTheDocument();
    expect(screen.queryByText("It's not you!")).not.toBeInTheDocument();
  });

  it('triggers onRetry when inline retry link is clicked', () => {
    const onRetry = vi.fn();
    const error: ClassifiedError = {
      type: 'server',
      isNetworkOrServer: true,
      canRetry: true,
      statusCode: 500,
      titleKey: 'error_server_title',
      descKey: 'error_server_desc',
      defaultTitle: 'Service unavailable',
      defaultDesc: 'Unable to load content right now. Please try again in a moment.',
    };

    render(<NetworkErrorState error={error} onRetry={onRetry} />);

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders compact mode correctly with plain text and retry link', () => {
    const onRetry = vi.fn();
    const error: ClassifiedError = {
      type: 'offline',
      isNetworkOrServer: true,
      canRetry: true,
      titleKey: 'error_network_title',
      descKey: 'error_network_desc',
      defaultTitle: 'Network issue',
      defaultDesc: 'There is a network issue. Please check your internet connection.',
    };

    render(<NetworkErrorState error={error} onRetry={onRetry} compact={true} />);

    expect(screen.getByText(/There is a network issue\. Please check your internet connection\./)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

