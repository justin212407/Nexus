export default function TechnicalBrief({ brief }) {
  if (!brief) return null

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: 8 }}>
      <strong>{brief.root_cause}</strong> - {brief.confidence_pct}% confidence
      <ul>
        {brief.causal_chain?.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  )
}
