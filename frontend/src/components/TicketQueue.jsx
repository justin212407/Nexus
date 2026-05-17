export default function TicketQueue({ tickets }) {
  return (
    <ul>
      {tickets.map((t) => (
        <li key={t.ticket_id}>
          {t.ticket_id} - {t.status}
        </li>
      ))}
    </ul>
  )
}
