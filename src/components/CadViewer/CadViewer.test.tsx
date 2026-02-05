import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CadViewer } from './CadViewer'

// Mock the CAD viewer library
const mockDocManager = {
  events: {
    documentActivated: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  },
  openUrl: vi.fn(),
  openDocument: vi.fn(),
  sendStringToExecute: vi.fn(),
  curView: {
    zoomToFitDrawing: vi.fn(),
  },
  regen: vi.fn(),
  destroy: vi.fn(),
}

vi.mock('@mlightcad/cad-simple-viewer', () => ({
  AcApDocManager: {
    createInstance: vi.fn(() => mockDocManager),
  },
}))

describe('CadViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDocManager.openUrl.mockResolvedValue(true)
    mockDocManager.openDocument.mockResolvedValue(true)
  })

  it('renders with default title', async () => {
    render(<CadViewer />)

    await waitFor(() => {
      expect(screen.getByText('CAD Viewer')).toBeInTheDocument()
    })
  })

  it('shows powered by text', async () => {
    render(<CadViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Powered by mlightcad/)).toBeInTheDocument()
    })
  })

  it('renders file upload button', async () => {
    render(<CadViewer />)

    await waitFor(() => {
      expect(screen.getByText('Upload DWG/DXF')).toBeInTheDocument()
    })
  })

  it('has correct file input accept attribute', async () => {
    render(<CadViewer />)

    await waitFor(() => {
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('accept', '.dwg,.dxf')
    })
  })

  it('shows initializing message initially', () => {
    render(<CadViewer />)
    expect(screen.getByText('Initializing CAD viewer...')).toBeInTheDocument()
  })
})

describe('CadViewer file handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDocManager.openUrl.mockResolvedValue(true)
    mockDocManager.openDocument.mockResolvedValue(true)
  })

  it('accepts dwg files', async () => {
    render(<CadViewer />)

    await waitFor(() => {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.accept).toContain('.dwg')
    })
  })

  it('accepts dxf files', async () => {
    render(<CadViewer />)

    await waitFor(() => {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.accept).toContain('.dxf')
    })
  })
})

describe('CadViewer structure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has cad-viewer container class', () => {
    const { container } = render(<CadViewer />)
    expect(container.querySelector('.cad-viewer')).toBeInTheDocument()
  })

  it('has cad-toolbar class', () => {
    const { container } = render(<CadViewer />)
    expect(container.querySelector('.cad-toolbar')).toBeInTheDocument()
  })

  it('has cad-container class', () => {
    const { container } = render(<CadViewer />)
    expect(container.querySelector('.cad-container')).toBeInTheDocument()
  })
})
