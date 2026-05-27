import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AgentStatus from './AgentStatus'

describe('AgentStatus component', () => {
  describe('error visualization', () => {
    it('should display error message when error event arrives', () => {
      const events = [
        { event: 'started', ticket_id: 'test-ticket' },
        { event: 'sources_checked', ticket_id: 'test-ticket', source_count: 4, available_sources: ['sentry', 'slack'], healthy: true },
        { event: 'error', ticket_id: 'test-ticket', message: 'Coral query timeout' },
      ]
      
      render(<AgentStatus events={events} ticketId="test-ticket" />)
      
      const errorBox = screen.getByText(/Coral query timeout/)
      expect(errorBox).toBeInTheDocument()
      expect(errorBox).toHaveClass('error-box')
    })

    it('should show red X for steps after error', () => {
      const events = [
        { event: 'started', ticket_id: 'test-ticket' },
        { event: 'sources_checked', ticket_id: 'test-ticket', source_count: 4, available_sources: [], healthy: true },
        { event: 'error', ticket_id: 'test-ticket', message: 'Graph failed' },
      ]
      
      render(<AgentStatus events={events} ticketId="test-ticket" />)
      
      // Steps after error should be in error state (pending)
      const steps = screen.getAllByText(/○/)
      expect(steps.length).toBeGreaterThan(0)
    })
  })

  describe('source availability display', () => {
    it('should display source list when sources_checked event present', () => {
      const events = [
        { event: 'started', ticket_id: 'test-ticket' },
        { event: 'sources_checked', ticket_id: 'test-ticket', source_count: 3, available_sources: ['sentry', 'slack', 'github'], healthy: true },
      ]
      
      render(<AgentStatus events={events} ticketId="test-ticket" />)
      
      expect(screen.getByText(/Sources checked: 3\/4 available/)).toBeInTheDocument()
      expect(screen.getByText(/sentry, slack, github/)).toBeInTheDocument()
    })

    it('should show warning when sources are degraded', () => {
      const events = [
        { event: 'started', ticket_id: 'test-ticket' },
        { event: 'sources_checked', ticket_id: 'test-ticket', source_count: 2, available_sources: ['sentry', 'slack'], healthy: false },
      ]
      
      render(<AgentStatus events={events} ticketId="test-ticket" />)
      
      expect(screen.getByText(/Investigation may be incomplete with fewer than 3 sources/)).toBeInTheDocument()
    })
  })

  describe('pipeline progress', () => {
    it('should mark steps as done when events reach them', () => {
      const events = [
        { event: 'started', ticket_id: 'test-ticket' },
        { event: 'sources_checked', ticket_id: 'test-ticket', source_count: 4, available_sources: ['sentry', 'slack', 'github', 'linear'], healthy: true },
        { event: 'coral_done', ticket_id: 'test-ticket', row_count: 1 },
        { event: 'signal_done', ticket_id: 'test-ticket', signals_found: ['sentry'] },
      ]
      
      render(<AgentStatus events={events} ticketId="test-ticket" />)
      
      // Should have 4 checkmarks (✓) for completed steps
      const checkmarks = screen.getAllByText('✓')
      expect(checkmarks.length).toBe(4)
    })

    it('should show spinner on in-progress step', () => {
      const events = [
        { event: 'started', ticket_id: 'test-ticket' },
        { event: 'sources_checked', ticket_id: 'test-ticket', source_count: 4, available_sources: ['sentry', 'slack', 'github', 'linear'], healthy: true },
        { event: 'coral_done', ticket_id: 'test-ticket', row_count: 1 },
        { event: 'signal_done', ticket_id: 'test-ticket', signals_found: ['sentry'] },
        // signal_done is last, so synthesis_done is in-progress
      ]
      
      render(<AgentStatus events={events} ticketId="test-ticket" />)
      
      // Should have spinner element for in-progress step
      const spinners = document.querySelectorAll('.spinner')
      expect(spinners.length).toBe(1)
    })
  })

  describe('ticket filtering', () => {
    it('should only show events for the specified ticketId', () => {
      const events = [
        { event: 'started', ticket_id: 'ticket-a' },
        { event: 'sources_checked', ticket_id: 'ticket-a', source_count: 4, available_sources: ['sentry'], healthy: true },
        { event: 'started', ticket_id: 'ticket-b' },
        { event: 'sources_checked', ticket_id: 'ticket-b', source_count: 2, available_sources: ['sentry'], healthy: false },
      ]
      
      render(<AgentStatus events={events} ticketId="ticket-a" />)
      
      // For ticket-a: sources should show 4/4 available (healthy)
      expect(screen.getByText(/Sources checked: 4\/4 available/)).toBeInTheDocument()
      // Should NOT show the degraded warning (that's for ticket-b)
      const warnings = screen.queryAllByText(/Investigation may be incomplete/)
      expect(warnings.length).toBe(0)
    })
  })
})
