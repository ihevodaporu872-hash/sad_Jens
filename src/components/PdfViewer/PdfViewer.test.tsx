import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PdfViewer } from './PdfViewer'

// Mock SimplePDF
vi.mock('@simplepdf', () => ({
  EmbedPDF: vi.fn(({ documentURL, locale }) => (
    <div data-testid="embed-pdf">
      <span data-testid="document-url">{documentURL}</span>
      <span data-testid="locale">{locale}</span>
      Mock EmbedPDF
    </div>
  )),
  useEmbed: vi.fn(() => ({
    embedRef: { current: null },
    actions: {
      download: vi.fn(),
      print: vi.fn(),
    },
  })),
}))

describe('PdfViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders PDF viewer title', () => {
    render(<PdfViewer />)
    expect(screen.getByText('PDF Viewer')).toBeInTheDocument()
  })

  it('shows powered by text', () => {
    render(<PdfViewer />)
    expect(screen.getByText(/Powered by SimplePDF/)).toBeInTheDocument()
  })

  it('renders EmbedPDF component', () => {
    render(<PdfViewer />)
    expect(screen.getByTestId('embed-pdf')).toBeInTheDocument()
  })

  it('renders with default props', () => {
    render(<PdfViewer />)
    // EmbedPDF component is rendered
    expect(screen.getByTestId('embed-pdf')).toBeInTheDocument()
  })

  it('uses custom document URL when provided', () => {
    render(<PdfViewer documentURL="/custom/document.pdf" />)
    expect(screen.getByTestId('document-url')).toHaveTextContent('/custom/document.pdf')
  })

  it('uses default locale (en)', () => {
    render(<PdfViewer />)
    expect(screen.getByTestId('locale')).toHaveTextContent('en')
  })

  it('uses custom locale when provided', () => {
    render(<PdfViewer locale="de" />)
    expect(screen.getByTestId('locale')).toHaveTextContent('de')
  })

  it('has pdf-viewer container class', () => {
    const { container } = render(<PdfViewer />)
    expect(container.querySelector('.pdf-viewer')).toBeInTheDocument()
  })

  it('has pdf-toolbar class', () => {
    const { container } = render(<PdfViewer />)
    expect(container.querySelector('.pdf-toolbar')).toBeInTheDocument()
  })

  it('has pdf-container class', () => {
    const { container } = render(<PdfViewer />)
    expect(container.querySelector('.pdf-container')).toBeInTheDocument()
  })

  it('renders h2 heading', () => {
    render(<PdfViewer />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('PDF Viewer')
  })
})

describe('PdfViewer supported locales', () => {
  const locales: Array<'en' | 'de' | 'es' | 'fr' | 'it' | 'pt' | 'nl'> = [
    'en', 'de', 'es', 'fr', 'it', 'pt', 'nl'
  ]

  locales.forEach(locale => {
    it(`supports ${locale} locale`, () => {
      render(<PdfViewer locale={locale} />)
      expect(screen.getByTestId('locale')).toHaveTextContent(locale)
    })
  })
})
