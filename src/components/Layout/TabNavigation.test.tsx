import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { TabNavigation } from './TabNavigation'

const renderWithRouter = (component: React.ReactNode) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('TabNavigation', () => {
  it('renders all navigation tabs', () => {
    renderWithRouter(<TabNavigation />)

    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('CAD')).toBeInTheDocument()
    expect(screen.getByText('IFC')).toBeInTheDocument()
  })

  it('renders correct links', () => {
    renderWithRouter(<TabNavigation />)

    const excelLink = screen.getByText('Excel').closest('a')
    const pdfLink = screen.getByText('PDF').closest('a')
    const cadLink = screen.getByText('CAD').closest('a')
    const ifcLink = screen.getByText('IFC').closest('a')

    expect(excelLink).toHaveAttribute('href', '/excel')
    expect(pdfLink).toHaveAttribute('href', '/pdf')
    expect(cadLink).toHaveAttribute('href', '/cad')
    expect(ifcLink).toHaveAttribute('href', '/ifc')
  })

  it('applies tab-link class to all links', () => {
    renderWithRouter(<TabNavigation />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)

    links.forEach(link => {
      expect(link).toHaveClass('tab-link')
    })
  })

  it('renders nav element', () => {
    renderWithRouter(<TabNavigation />)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('tab-navigation')
  })
})
