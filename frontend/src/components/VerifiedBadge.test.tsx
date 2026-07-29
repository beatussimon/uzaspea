import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VerifiedBadge from './VerifiedBadge';

describe('VerifiedBadge', () => {
  it('renders correctly', () => {
    render(<VerifiedBadge isVerified={true} tier="business" />);
    expect(screen.getByTitle('Business Verified Seller')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<VerifiedBadge isVerified={true} tier="business" className="test-class" />);
    expect(container.firstChild).toHaveClass('test-class');
  });
});
