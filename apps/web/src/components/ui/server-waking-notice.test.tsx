/**
 * Tests for: ServerWakingNotice
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Component: ServerWakingNotice
 * Covers criteria: #2, #3 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServerWakingNotice } from '@/components/ui/server-waking-notice';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';

describe('ServerWakingNotice', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<ServerWakingNotice show={false} />);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one polite status line with the English text when show is true', () => {
    render(<ServerWakingNotice show />);

    const notice = screen.getByTestId('server-waking-notice');
    expect(notice).toHaveTextContent('Waking the server. This can take up to a minute on the first visit.');
    expect(notice).toHaveTextContent(en['common.serverWaking']);
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(notice.tagName).toBe('P');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('shows the Spanish text under a Spanish provider', () => {
    render(
      <I18nProvider initialLocale="es">
        <ServerWakingNotice show />
      </I18nProvider>,
    );

    expect(screen.getByTestId('server-waking-notice')).toHaveTextContent(
      'Despertando el servidor. En la primera visita puede tardar hasta un minuto.',
    );
    expect(es['common.serverWaking']).not.toBe(en['common.serverWaking']);
  });

  it('appears and disappears as show changes', () => {
    const { rerender } = render(<ServerWakingNotice show={false} />);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();

    rerender(<ServerWakingNotice show />);
    expect(screen.getByTestId('server-waking-notice')).toBeInTheDocument();

    rerender(<ServerWakingNotice show={false} />);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('applies a caller className', () => {
    render(<ServerWakingNotice show className="extra-class" />);

    expect(screen.getByTestId('server-waking-notice')).toHaveClass('extra-class');
  });
});
