import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExcelViewer } from './ExcelViewer'

// Mock Univer with proper class constructor
const mockUniver = {
  registerPlugin: vi.fn(),
  createUnit: vi.fn(),
  dispose: vi.fn(),
}

vi.mock('@univerjs/core', () => ({
  Univer: vi.fn(function() { return mockUniver }),
  LocaleType: { EN_US: 'en-US' },
  UniverInstanceType: { UNIVER_SHEET: 'sheet' },
}))

vi.mock('@univerjs/design', () => ({
  defaultTheme: { name: 'default' },
}))

vi.mock('@univerjs/sheets', () => ({
  UniverSheetsPlugin: vi.fn(),
}))

vi.mock('@univerjs/sheets-ui', () => ({
  UniverSheetsUIPlugin: vi.fn(),
}))

vi.mock('@univerjs/ui', () => ({
  UniverUIPlugin: vi.fn(),
}))

vi.mock('@univerjs/engine-formula', () => ({
  UniverFormulaEnginePlugin: vi.fn(),
}))

vi.mock('@univerjs/engine-render', () => ({
  UniverRenderEnginePlugin: vi.fn(),
}))

// Mock CSS imports
vi.mock('@univerjs/design/global.css', () => ({}))
vi.mock('@univerjs/ui/global.css', () => ({}))
vi.mock('@univerjs/sheets-ui/global.css', () => ({}))

describe('ExcelViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Excel viewer title', () => {
    render(<ExcelViewer />)
    expect(screen.getByText('Excel Viewer')).toBeInTheDocument()
  })

  it('shows powered by text', () => {
    render(<ExcelViewer />)
    expect(screen.getByText(/Powered by Univer/)).toBeInTheDocument()
  })

  it('describes editing capabilities', () => {
    render(<ExcelViewer />)
    expect(screen.getByText(/Edit cells, use formulas, and format your spreadsheet/)).toBeInTheDocument()
  })

  it('has excel-viewer container class', () => {
    const { container } = render(<ExcelViewer />)
    expect(container.querySelector('.excel-viewer')).toBeInTheDocument()
  })

  it('has excel-toolbar class', () => {
    const { container } = render(<ExcelViewer />)
    expect(container.querySelector('.excel-toolbar')).toBeInTheDocument()
  })

  it('has excel-container class', () => {
    const { container } = render(<ExcelViewer />)
    expect(container.querySelector('.excel-container')).toBeInTheDocument()
  })

  it('renders h2 heading', () => {
    render(<ExcelViewer />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Excel Viewer')
  })
})
