import React from 'react'

const styles = `
  .agent-status-container {
    font-family: monospace;
    padding: 16px;
    background: #1a1a1a;
    border-radius: 4px;
    color: #fff;
  }
  
  .agent-step {
    margin: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .step-icon {
    width: 20px;
    text-align: center;
    font-weight: bold;
  }
  
  .step-done {
    color: #4ade80;
  }
  
  .step-in-progress {
    color: #fb923c;
  }
  
  .step-error {
    color: #ef4444;
  }
  
  .step-pending {
    color: #666;
  }
  
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid #fb923c;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .sources-info {
    margin-top: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-left: 2px solid #3b82f6;
    font-size: 12px;
  }
  
  .sources-list {
    margin-top: 4px;
    color: #999;
  }
  
  .error-box {
    margin-top: 12px;
    padding: 8px;
    background: rgba(239, 68, 68, 0.1);
    border-left: 2px solid #ef4444;
    border-radius: 2px;
    color: #fca5a5;
    font-size: 12px;
  }
  
  .hint-text {
    margin-top: 8px;
    font-size: 11px;
    color: #666;
    font-style: italic;
  }
`

const STEP_LABELS = {
  started: 'Ticket Received',
  sources_checked: 'Sources Checked',
  coral_done: 'Coral Query',
  signal_done: 'Signal Transform',
  synthesis_done: 'Claude Analysis',
  completed: 'Completed'
}

export default function AgentStatus({ events, ticketId }) {
  const filteredEvents = events.filter((e) => e.ticket_id === ticketId)
  const eventMap = new Map(filteredEvents.map(e => [e.event, e]))
  
  // Including new sources_checked step in the pipeline
  const steps = ['started', 'sources_checked', 'coral_done', 'signal_done', 'synthesis_done', 'completed']
  const reachedEvents = filteredEvents.map((e) => e.event)
  
  // Check for error
  const errorEvent = eventMap.get('error')
  const sourcesEvent = eventMap.get('sources_checked')
  
  // Determine step state
  const getStepState = (step) => {
    if (reachedEvents.includes(step)) {
      return 'done'
    }
    if (errorEvent && step !== 'started' && step !== 'sources_checked') {
      // Steps after error are blocked
      return 'pending'
    }
    // Check if this is the current step (last reached step is different)
    if (reachedEvents.length > 0) {
      const lastStep = reachedEvents[reachedEvents.length - 1]
      const stepIndex = steps.indexOf(step)
      const lastIndex = steps.indexOf(lastStep)
      if (stepIndex === lastIndex + 1) {
        return 'in-progress'
      }
    }
    return 'pending'
  }
  
  const getStepIcon = (step) => {
    const state = getStepState(step)
    if (state === 'done') {
      return '✓'
    } else if (state === 'in-progress') {
      return <span className="spinner"></span>
    } else {
      return '○'
    }
  }
  
  const getStepColor = (step) => {
    const state = getStepState(step)
    if (state === 'done') {
      return 'step-done'
    } else if (state === 'in-progress') {
      return 'step-in-progress'
    } else if (errorEvent) {
      return 'step-error'
    } else {
      return 'step-pending'
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="agent-status-container">
        {steps.map((step) => (
          <div key={step} className={`agent-step ${getStepColor(step)}`}>
            <div className="step-icon">
              {getStepIcon(step)}
            </div>
            <span>{STEP_LABELS[step] || step}</span>
          </div>
        ))}
        
        {sourcesEvent && (
          <div className="sources-info">
            Sources checked: {sourcesEvent.source_count}/4 available
            {sourcesEvent.available_sources && sourcesEvent.available_sources.length > 0 && (
              <div className="sources-list">
                ✓ {sourcesEvent.available_sources.join(', ')}
              </div>
            )}
            {!sourcesEvent.healthy && (
              <div className="hint-text">
                ⚠ Investigation may be incomplete with fewer than 3 sources
              </div>
            )}
          </div>
        )}
        
        {errorEvent && (
          <div className="error-box">
            <strong>Error:</strong> {errorEvent.message}
          </div>
        )}
      </div>
    </>
  )
}
