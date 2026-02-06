import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PdfViewer } from './PdfViewer';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 0,
      destroy: vi.fn(),
    }),
  })),
}));

describe('PdfViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PDF viewer title', () => {
    render(<PdfViewer />);
    expect(screen.getByText('PDF Viewer')).toBeInTheDocument();
  });

  it('has pdf-viewer-wrapper container', () => {
    const { container } = render(<PdfViewer />);
    expect(container.querySelector('.pdf-viewer-wrapper')).toBeInTheDocument();
  });

  it('has pdf-toolbar class', () => {
    const { container } = render(<PdfViewer />);
    expect(container.querySelector('.pdf-toolbar')).toBeInTheDocument();
  });

  it('has pdf-container class', () => {
    const { container } = render(<PdfViewer />);
    expect(container.querySelector('.pdf-container')).toBeInTheDocument();
  });

  it('renders Upload PDF button', () => {
    render(<PdfViewer />);
    expect(screen.getByText('Upload PDF')).toBeInTheDocument();
  });

  it('renders Load Markup button', () => {
    render(<PdfViewer />);
    expect(screen.getByText('Load Markup')).toBeInTheDocument();
  });

  it('renders Load Test PDF button', () => {
    render(<PdfViewer />);
    expect(screen.getByTestId('load-test-pdf')).toBeInTheDocument();
  });

  it('renders h2 heading', () => {
    render(<PdfViewer />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('PDF Viewer');
  });

  it('shows empty state message', () => {
    render(<PdfViewer />);
    expect(screen.getByText(/Drop PDF/)).toBeInTheDocument();
  });

  it('shows markup support info', () => {
    render(<PdfViewer />);
    expect(screen.getByText(/Supports XML and JSON/)).toBeInTheDocument();
  });
});
