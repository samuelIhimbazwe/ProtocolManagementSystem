import { BulletinDocument, BulletinSection } from '../DisplayFormatToggle'

const STATUS_LABEL = {
  Present: 'P',
  'Half Present': '½',
  'Quarter Present': '¼',
  Absent: 'A',
}

export default function AttendanceSessionBulletin({ id, serviceType, serviceDate, rows, title = 'Service attendance roll' }) {
  const dateLabel = serviceDate
    ? new Date(`${serviceDate}T12:00:00`).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

  return (
    <BulletinDocument
      id={id}
      title={title}
      subtitle={`${serviceType}${dateLabel ? ` · ${dateLabel}` : ''}`}
      footer="P = Present · ½ = Half · ¼ = Quarter · A = Absent"
    >
      <BulletinSection title="Protocol team">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-400">
              <th className="text-left py-1 font-semibold w-8">#</th>
              <th className="text-left py-1 font-semibold">Member</th>
              <th className="text-left py-1 font-semibold w-16">Mark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.name} className="border-b border-neutral-200">
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{row.name}</td>
                <td className="py-1 font-mono font-bold">{STATUS_LABEL[row.status] ?? row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </BulletinSection>
    </BulletinDocument>
  )
}
