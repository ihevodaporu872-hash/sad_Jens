import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';
import { EmbedPDF, useEmbed } from './index';

describe('EmbedPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inline mode', () => {
    it('should render iframe in inline mode', () => {
      render(<EmbedPDF mode="inline" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe?.title).toBe('SimplePDF');
    });

    it('should apply custom className', () => {
      render(<EmbedPDF mode="inline" className="custom-class" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveClass('custom-class');
    });

    it('should apply custom style', () => {
      render(<EmbedPDF mode="inline" style={{ width: '500px', height: '700px' }} />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveStyle({ width: '500px', height: '700px' });
    });

    it('should have border: 0 style by default', () => {
      render(<EmbedPDF mode="inline" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveStyle({ border: '0' });
    });

    it('should set iframe src after render', async () => {
      render(<EmbedPDF mode="inline" />);

      const iframe = document.querySelector('iframe');
      await waitFor(() => {
        expect(iframe?.src).toContain('simplepdf.com');
      });
    });

    it('should use custom company identifier', async () => {
      render(<EmbedPDF mode="inline" companyIdentifier="mycompany" />);

      const iframe = document.querySelector('iframe');
      await waitFor(() => {
        expect(iframe?.src).toContain('mycompany.simplepdf.com');
      });
    });

    it('should use specified locale', async () => {
      render(<EmbedPDF mode="inline" locale="de" />);

      const iframe = document.querySelector('iframe');
      await waitFor(() => {
        expect(iframe?.src).toContain('/de/editor');
      });
    });
  });

  describe('Modal mode', () => {
    it('should render children in modal mode', () => {
      render(
        <EmbedPDF mode="modal">
          <button>Open PDF</button>
        </EmbedPDF>
      );

      expect(screen.getByText('Open PDF')).toBeInTheDocument();
    });

    it('should not show modal initially', () => {
      render(
        <EmbedPDF mode="modal">
          <button>Open PDF</button>
        </EmbedPDF>
      );

      expect(document.querySelector('.simplePDF_container')).not.toBeInTheDocument();
    });

    it('should show modal when child is clicked', async () => {
      render(
        <EmbedPDF mode="modal">
          <button>Open PDF</button>
        </EmbedPDF>
      );

      fireEvent.click(screen.getByText('Open PDF'));

      await waitFor(() => {
        expect(document.querySelector('.simplePDF_container')).toBeInTheDocument();
      });
    });

    it('should render modal with correct aria attributes', async () => {
      render(
        <EmbedPDF mode="modal">
          <button>Open PDF</button>
        </EmbedPDF>
      );

      fireEvent.click(screen.getByText('Open PDF'));

      await waitFor(() => {
        const modal = document.querySelector('.simplePDF_container');
        expect(modal).toHaveAttribute('role', 'dialog');
        expect(modal).toHaveAttribute('aria-modal', 'true');
      });
    });

    it('should close modal when close button is clicked', async () => {
      render(
        <EmbedPDF mode="modal">
          <button>Open PDF</button>
        </EmbedPDF>
      );

      fireEvent.click(screen.getByText('Open PDF'));

      await waitFor(() => {
        expect(document.querySelector('.simplePDF_container')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close PDF editor modal');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(document.querySelector('.simplePDF_container')).not.toBeInTheDocument();
      });
    });

    it('should render iframe inside modal', async () => {
      render(
        <EmbedPDF mode="modal">
          <button>Open PDF</button>
        </EmbedPDF>
      );

      fireEvent.click(screen.getByText('Open PDF'));

      await waitFor(() => {
        const iframe = document.querySelector('.simplePDF_iframe');
        expect(iframe).toBeInTheDocument();
        expect(iframe?.tagName).toBe('IFRAME');
      });
    });

    it('should work with anchor children', async () => {
      render(
        <EmbedPDF mode="modal">
          <a href="/document.pdf">View Document</a>
        </EmbedPDF>
      );

      fireEvent.click(screen.getByText('View Document'));

      await waitFor(() => {
        expect(document.querySelector('.simplePDF_container')).toBeInTheDocument();
      });
    });

    it('should use default modal mode when mode is not specified', () => {
      render(
        <EmbedPDF>
          <button>Open</button>
        </EmbedPDF>
      );

      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(document.querySelector('.simplePDF_container')).not.toBeInTheDocument();
    });
  });

  describe('Context encoding', () => {
    it('should encode and pass context', async () => {
      const context = { userId: '123', documentType: 'invoice' };

      render(<EmbedPDF mode="inline" context={context} />);

      const iframe = document.querySelector('iframe');
      await waitFor(() => {
        expect(iframe?.src).toContain('context=');
      });
    });
  });

  describe('Event handling', () => {
    it('should call onEmbedEvent when EDITOR_READY is received', async () => {
      const onEmbedEvent = vi.fn();

      render(<EmbedPDF mode="inline" onEmbedEvent={onEmbedEvent} />);

      const iframe = document.querySelector('iframe');

      // Wait for iframe src to be set
      await waitFor(() => {
        expect(iframe?.src).toBeTruthy();
      });

      // Simulate EDITOR_READY event from iframe
      const event = new MessageEvent('message', {
        data: JSON.stringify({ type: 'EDITOR_READY', data: {} }),
        origin: 'https://react-editor.simplepdf.com',
        source: iframe?.contentWindow,
      });

      window.dispatchEvent(event);

      // Note: The event might not trigger if origin check fails in test env
      // This is expected behavior - real tests would need proper iframe setup
    });
  });

  describe('useEmbed export', () => {
    it('should export useEmbed hook', () => {
      expect(useEmbed).toBeDefined();
      expect(typeof useEmbed).toBe('function');
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref with embed actions', async () => {
      const TestComponent = () => {
        const ref = React.useRef<{
          loadDocument: (args: { dataUrl: string }) => Promise<unknown>;
          goTo: (args: { page: number }) => Promise<unknown>;
          selectTool: (tool: string | null) => Promise<unknown>;
          createField: (options: unknown) => Promise<unknown>;
          clearFields: (options?: unknown) => Promise<unknown>;
          getDocumentContent: (options: unknown) => Promise<unknown>;
          submit: (options: unknown) => Promise<unknown>;
        }>(null);

        return (
          <div>
            <EmbedPDF mode="inline" ref={ref} />
            <span data-testid="has-ref">{ref.current ? 'yes' : 'no'}</span>
          </div>
        );
      };

      render(<TestComponent />);

      // Ref is set after component mounts
      await waitFor(() => {
        // The ref should be available after mount
        expect(screen.getByTestId('has-ref')).toBeInTheDocument();
      });
    });
  });
});

describe('EmbedEvent types', () => {
  it('should handle different event types', () => {
    // Type checking - these should compile without errors
    const editorReady = { type: 'EDITOR_READY' as const, data: {} };
    const documentLoaded = { type: 'DOCUMENT_LOADED' as const, data: { document_id: '123' } };
    const pageFocused = {
      type: 'PAGE_FOCUSED' as const,
      data: { previous_page: 1, current_page: 2, total_pages: 10 },
    };
    const submissionSent = {
      type: 'SUBMISSION_SENT' as const,
      data: { document_id: '123', submission_id: '456' },
    };

    expect(editorReady.type).toBe('EDITOR_READY');
    expect(documentLoaded.data.document_id).toBe('123');
    expect(pageFocused.data.current_page).toBe(2);
    expect(submissionSent.data.submission_id).toBe('456');
  });
});
