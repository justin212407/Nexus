export default function TechnicalBrief({ brief, ticketId }) {
  if (!brief) return null

  const ROOT_CAUSE_STYLE = {
    known_bug:           'bg-red-100 text-red-800 border-red-200',
    service_degradation: 'bg-orange-100 text-orange-800 border-orange-200',
    user_error:          'bg-blue-100 text-blue-800 border-blue-200',
    external_dependency: 'bg-purple-100 text-purple-800 border-purple-200',
    unknown:             'bg-gray-100 text-gray-800 border-gray-200',
  }

  const confidenceColor =
    brief.confidence_pct >= 70 ? 'text-green-600' :
    brief.confidence_pct >= 50 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ROOT_CAUSE_STYLE[brief.root_cause] || ROOT_CAUSE_STYLE.unknown}`}>
            {brief.root_cause.replace(/_/g, ' ')}
          </span>
          <span className={`text-lg font-bold ${confidenceColor}`}>
            {brief.confidence_pct}%
          </span>
          <span className="text-xs text-gray-400">confidence</span>
        </div>
        <span className="text-xs text-gray-500">
          {brief.affected_users?.toLocaleString()} users · {brief.affected_service}
        </span>
      </div>

      {/* Causal chain timeline */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Causal Chain
        </div>
        <div className="space-y-1.5">
          {brief.causal_chain?.map((step, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold mt-0.5">
                {i + 1}
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engineer summary */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Engineer Summary
        </div>
        <p className="text-xs text-gray-700 leading-relaxed">{brief.engineer_summary}</p>
      </div>

      {/* Draft customer response */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
          Draft Customer Response
        </div>
        <p className="text-xs text-blue-800 leading-relaxed">{brief.draft_customer_response}</p>
      </div>

      {/* Action + Linear link */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-600">
          <span className="font-semibold">Action: </span>
          {brief.recommended_action}
        </p>
        {brief.linear_issue_id && (
          <a
            href={`https://linear.app/issue/${brief.linear_issue_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded px-2 py-1 bg-indigo-50 flex-shrink-0"
          >
            {brief.linear_issue_id} ↗
          </a>
        )}
      </div>
    </div>
  )
}
