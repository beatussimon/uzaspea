import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VerifiedBadge from './VerifiedBadge';

describe('VerifiedBadge', () => {
  it('renders correctly', () => {
    render(<VerifiedBadge isVerified={true} tier="business" />);
    expect(screen.getByTitle('Business Verified Seller')).toBeInTheDocument();
  });

  it('renders gray checkmark for seller_lite', () => {
    render(<VerifiedBadge isVerified={true} tier="seller_lite" />);
    const img = screen.getByTitle('Verified Merchant (In-Store POS & Services)');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/gray_checkmark.png');
  });

  it('applies custom className', () => {
    const { container } = render(<VerifiedBadge isVerified={true} tier="business" className="test-class" />);
    expect(container.firstChild).toHaveClass('test-class');
  });
});
