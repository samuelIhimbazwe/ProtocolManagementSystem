import { useEffect, useState } from 'react'
import { BulletinDocument, BulletinSection } from '../DisplayFormatToggle'
import BulletinEditable from './BulletinEditable'

const STATUS_LABEL = {
  Present: 'P',
  'Half Present': '½',
  'Quarter Present': '¼',
  Absent: 'A',
}

export default function AttendanceSessionBulletin({
  id,
  serviceType,
  serviceDate,
  rows,
  title = 'Service attendance roll',
  canEdit = false,
}) {
  const dateLabel = serviceDate
    ? new Date(`${serviceDate}T12:00:00`).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

  const [sectionTitle, setSectionTitle] = useState('Protocol team')
  const [colHeaders, setColHeaders] = useState({ member: 'Member', mark: 'Mark' })
  const [tableRows, setTableRows] = useState(
    (rows ?? []).map((r) => ({
      name: r.name,
      mark: STATUS_LABEL[r.status] ?? r.status,
    })),
  )

  useEffect(() => {
    setTableRows(
      (rows ?? []).map((r) => ({
        name: r.name,
        mark: STATUS_LABEL[r.status] ?? r.status,
      })),
    )
  }, [rows])

  const patchRow = (index, key, value) =>
    setTableRows((list) => list.map((r, i) => (i === index ? { ...r, [key]: value } : r)))

  return (
    <BulletinDocument
      id={id}
      title={title}
      subtitle={`${serviceType}${dateLabel ? ` · ${dateLabel}` : ''}`}
      footer="P = Present · ½ = Half · ¼ = Quarter · A = Absent"
      canEdit={canEdit}
    >
      <BulletinSection title={sectionTitle} canEdit={canEdit}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-400">
              <th className="text-left py-1 font-semibold w-8">#</th>
              <th className="text-left py-1 font-semibold">
                <BulletinEditable
                  value={colHeaders.member}
                  onChange={canEdit ? (v) => setColHeaders((h) => ({ ...h, member: v })) : undefined}
                  disabled={!canEdit}
                />
              </th>
              <th className="text-left py-1 font-semibold w-16">
                <BulletinEditable
                  value={colHeaders.mark}
                  onChange={canEdit ? (v) => setColHeaders((h) => ({ ...h, mark: v })) : undefined}
                  disabled={!canEdit}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr key={`${row.name}-${i}`} className="border-b border-neutral-200">
                <td className="py-1">{i + 1}</td>
                <td className="py-1">
                  <BulletinEditable
                    value={row.name}
                    onChange={canEdit ? (v) => patchRow(i, 'name', v) : undefined}
                    disabled={!canEdit}
                  />
                </td>
                <td className="py-1 font-mono font-bold">
                  <BulletinEditable
                    value={row.mark}
                    onChange={canEdit ? (v) => patchRow(i, 'mark', v) : undefined}
                    disabled={!canEdit}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BulletinSection>
    </BulletinDocument>
  )
}
