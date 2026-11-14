import { render, screen } from '@testing-library/react'
import { Card } from '../src/shared/components/Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>content</Card>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Card title="Readiness">body</Card>)
    expect(screen.getByText('Readiness')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<Card subtitle="Yesterday">body</Card>)
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('omits title element when not provided', () => {
    const { container } = render(<Card>body</Card>)
    expect(container.querySelector('[class*="title"]')).toBeNull()
  })
})
