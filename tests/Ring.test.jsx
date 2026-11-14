import { render, screen } from '@testing-library/react'
import { Ring } from '../src/shared/components/Ring'

describe('Ring', () => {
  it('renders the percentage value', () => {
    render(<Ring pct={72} color="#30d158" label="Readiness" />)
    expect(screen.getByText('72')).toBeInTheDocument()
  })

  it('renders the label', () => {
    render(<Ring pct={72} color="#30d158" label="Readiness" />)
    expect(screen.getByText('Readiness')).toBeInTheDocument()
  })

  it('renders ? when pct is null', () => {
    render(<Ring pct={null} color="#30d158" label="Recovery" />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies fill circle stroke-dashoffset for given pct', () => {
    const { container } = render(<Ring pct={50} color="#007aff" label="Sleep" />)
    const circles = container.querySelectorAll('circle')
    // second circle is the fill; dashoffset should be half the circumference
    const fill = circles[1]
    const C = 2 * Math.PI * 38
    expect(parseFloat(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(C / 2, 0)
  })
})
