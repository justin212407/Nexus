import { useEffect, useState } from 'react'

export default function MetricsBar() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/stats').then((r) => r.json()).then(setStats)
  }, [])

  if (!stats) return null

  return <pre style={{ fontSize: 11 }}>{JSON.stringify(stats, null, 2)}</pre>
}
