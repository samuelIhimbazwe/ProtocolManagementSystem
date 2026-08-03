import { parseChoirList } from '../ChoirCardActions'
import BulletinChurchHeader from './BulletinChurchHeader'
import {
  assignmentHasChoirs,
  choirServiceBucket,
  formatBulletinDateSlash,
  groupChoirByWeek,
  parseBulletinDateParts,
  shortChoirDisplayName,
  weekChoirGridReady,
  weekRangeLabelFromItems,
} from '../../lib/bulletinWeeks'

const RW_WEEK = ['', 'ICYUMWERU CYA MBERE', 'ICYUMWERU CYA KABIRI', 'ICYUMWERU CYA GATATU', 'ICYUMWERU CYA KANE', 'ICYUMWERU CYA GATANU']

function choirsForBucket(weekItems, bucket) {
  const hit = weekItems.find(({ row }) => choirServiceBucket(row.service) === bucket)
  if (!hit) return []
  return parseChoirList(hit.row.choirs).map(shortChoirDisplayName)
}

function cellDate(weekItems, bucket) {
  const hit = weekItems.find(({ row }) => choirServiceBucket(row.service) === bucket)
  if (!hit?.parts) return ''
  return formatBulletinDateSlash(hit.parts)
}

function choirServiceBarLabel(row, year) {
  const parts = parseBulletinDateParts(row.date, year)
  const date = formatBulletinDateSlash(parts)
  const svc = row.service ?? ''
  if (/Tuesday/i.test(svc)) return `Kuwa kabiri ${date}`
  if (/Friday/i.test(svc)) return `Kuwa gatanu ${date}`
  if (/Sunday Service 1/i.test(svc)) return `Iteraniro rya mbere ${date}`
  if (/Sunday Service 2/i.test(svc)) return `Iteraniro rya kabiri ${date}`
  return `${svc} ${date}`
}

function ChoirCell({ names }) {
  return (
    <td className="pmss-choir-cell">
      {names.map((n) => (
        <div key={n} className="pmss-choir-cell-line">
          {n}
        </div>
      ))}
    </td>
  )
}

function ChoirServiceFallback({ row, year }) {
  const names = parseChoirList(row.choirs).map(shortChoirDisplayName)
  if (!names.length) return null
  return (
    <div className="pmss-bulletin-service-block">
      <div className="pmss-bulletin-service-bar pmss-bulletin-service-bar--choir">
        <span aria-hidden>➤</span> {choirServiceBarLabel(row, year)}
      </div>
      <ul className="pmss-choir-fallback-list">
        {names.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}

export default function ChoirScheduleBulletin({ id, assignments, monthLabel = 'August 2026' }) {
  const year = Number(monthLabel.match(/\d{4}/)?.[0]) || 2026

  const withChoirs = assignments.filter((row) => assignmentHasChoirs(row, parseChoirList))
  const regular = withChoirs.filter((row) => choirServiceBucket(row.service) !== 'igaburo')
  const igaburoRows = withChoirs.filter((row) => choirServiceBucket(row.service) === 'igaburo')
  const weeks = groupChoirByWeek(regular, year)

  const gridWeeks = []
  const fallbackRows = []

  weeks.forEach(([weekKey, items], weekIndex) => {
    const filled = items.filter(({ row }) => assignmentHasChoirs(row, parseChoirList))
    if (weekChoirGridReady(filled, parseChoirList)) {
      gridWeeks.push({ weekKey, items: filled, weekIndex })
    } else {
      filled.forEach((item) => fallbackRows.push(item.row))
    }
  })

  const monthUpper = monthLabel.replace(/\d{4}/, '').trim().toUpperCase()
  const title = `UKO AMAKORALI AZITABIRA AMATERANIRO MURI ${monthUpper}`

  return (
    <article id={id} className="pmss-bulletin pmss-bulletin--choir">
      <BulletinChurchHeader churchLine="ADEPR ITORERO RYA KACYIRU" title={title} subtitle={monthLabel} />

      {gridWeeks.map(({ weekKey, items, weekIndex }) => (
        <section key={weekKey} className="pmss-choir-week-section">
          <div className="pmss-choir-week-banner">
            {RW_WEEK[weekIndex + 1] ?? `WEEK ${weekIndex + 1}`} · {weekRangeLabelFromItems(items)}
          </div>
          <table className="pmss-choir-grid">
            <thead>
              <tr>
                <th className="pmss-choir-th pmss-choir-th--tue">KUWA KABIRI</th>
                <th className="pmss-choir-th pmss-choir-th--fri">KUWA GATANU</th>
                <th className="pmss-choir-th pmss-choir-th--sun" colSpan={2}>
                  KU CYUMWERU
                </th>
              </tr>
              <tr>
                <th className="pmss-choir-th-sub">{cellDate(items, 'tuesday')}</th>
                <th className="pmss-choir-th-sub">{cellDate(items, 'friday')}</th>
                <th className="pmss-choir-th-sub pmss-choir-th--ss1">ITERANIRO RYA MBERE</th>
                <th className="pmss-choir-th-sub pmss-choir-th--ss2">ITERANIRO RYA KABIRI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <ChoirCell names={choirsForBucket(items, 'tuesday')} />
                <ChoirCell names={choirsForBucket(items, 'friday')} />
                <ChoirCell names={choirsForBucket(items, 'sunday1')} />
                <ChoirCell names={choirsForBucket(items, 'sunday2')} />
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      {fallbackRows.length > 0 && (
        <section className="pmss-choir-fallback-section">
          {fallbackRows.map((row) => (
            <ChoirServiceFallback key={`${row.service}-${row.date}`} row={row} year={year} />
          ))}
        </section>
      )}

      {igaburoRows.length > 0 && (
        <section className="pmss-choir-igaburo">
          <div className="pmss-choir-igaburo-banner">
            IGABURO RYERA
            {igaburoRows[0]?.date && (
              <> · {formatBulletinDateSlash(parseBulletinDateParts(igaburoRows[0].date, year))}</>
            )}
          </div>
          <table className="pmss-choir-grid pmss-choir-grid--igaburo">
            <tbody>
              {igaburoRows.flatMap((row) =>
                parseChoirList(row.choirs).map((name) => (
                  <tr key={`${row.date}-${name}`}>
                    <td className="pmss-choir-cell">Chorale {shortChoirDisplayName(name)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      )}

      <footer className="pmss-bulletin-signatures">
        <p>Byateguwe na Minisiteri y&apos;Abaririmbyi Itorero rya KACYIRU / {monthUpper}</p>
        <p>Byagenzuwe n&apos;Umuyobozi Wungirije w&apos;Itorero rya KACYIRU</p>
        <p>Byemejwe n&apos;Umushumba w&apos;Itorero ADEPR Kacyiru</p>
      </footer>
    </article>
  )
}
