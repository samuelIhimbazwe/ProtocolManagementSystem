import { useEffect, useMemo, useState } from 'react'
import { joinChoirList, parseChoirList } from '../ChoirCardActions'
import BulletinChurchHeader from './BulletinChurchHeader'
import BulletinEditable from './BulletinEditable'
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

const RW_WEEK = [
  '',
  'ICYUMWERU CYA MBERE',
  'ICYUMWERU CYA KABIRI',
  'ICYUMWERU CYA GATATU',
  'ICYUMWERU CYA KANE',
  'ICYUMWERU CYA GATANU',
]

const DEFAULT_HEADERS = {
  tue: 'KUWA KABIRI',
  fri: 'KUWA GATANU',
  sun: 'KU CYUMWERU',
  ss1: 'ITERANIRO RYA MBERE',
  ss2: 'ITERANIRO RYA KABIRI',
  igaburo: 'IGABURO RYERA',
}

function rowKey(row) {
  return `${row.service}-${row.date}-${row.serviceDate ?? ''}`
}

function choirsForBucket(weekItems, bucket) {
  const hit = weekItems.find(({ row }) => choirServiceBucket(row.service) === bucket)
  if (!hit) return []
  return parseChoirList(hit.row.choirs)
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

function normalizeEditedChoirName(edited, previous) {
  const next = String(edited ?? '').trim()
  if (!next) return ''
  if (previous && /Choir$/i.test(previous) && !/Choir$/i.test(next)) {
    return `${next} Choir`
  }
  return next
}

function ChoirCell({ names, canEdit, displayShort, onNameChange }) {
  return (
    <td className="pmss-choir-cell">
      {(names.length ? names : canEdit ? [''] : []).map((n, i) => {
        const display = displayShort && n ? shortChoirDisplayName(n) : n
        return (
          <div key={`${n}-${i}`} className="pmss-choir-cell-line">
            <BulletinEditable
              value={display}
              placeholder="Choir"
              onChange={canEdit ? (v) => onNameChange(i, v) : undefined}
              disabled={!canEdit}
            />
          </div>
        )
      })}
    </td>
  )
}

function ChoirServiceFallback({
  row,
  year,
  canEdit,
  titleOverride,
  onTitleChange,
  onChoirChange,
}) {
  const names = parseChoirList(row.choirs)
  const title = titleOverride ?? choirServiceBarLabel(row, year)
  if (!names.length && !canEdit) return null
  return (
    <div className="pmss-bulletin-service-block">
      <div className="pmss-bulletin-service-bar pmss-bulletin-service-bar--choir">
        <span aria-hidden>➤</span>{' '}
        <BulletinEditable
          value={title}
          onChange={canEdit ? onTitleChange : undefined}
          disabled={!canEdit}
        />
      </div>
      <ul className="pmss-choir-fallback-list">
        {(names.length ? names : ['']).map((n, i) => (
          <li key={`${n}-${i}`}>
            <BulletinEditable
              value={canEdit ? n : shortChoirDisplayName(n)}
              placeholder="Choir"
              onChange={canEdit ? (v) => onChoirChange(i, v) : undefined}
              disabled={!canEdit}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * ADEPR-style choir bulletin — fully editable when canEdit.
 * Choir name edits sync back through onAssignmentsChange.
 */
export default function ChoirScheduleBulletin({
  id,
  assignments,
  monthLabel = 'August 2026',
  canEdit = false,
  onAssignmentsChange,
}) {
  const year = Number(monthLabel.match(/\d{4}/)?.[0]) || 2026
  const monthUpper = monthLabel.replace(/\d{4}/, '').trim().toUpperCase()
  const defaultTitle = `UKO AMAKORALI AZITABIRA AMATERANIRO MURI ${monthUpper}`

  const [churchLine, setChurchLine] = useState('ADEPR ITORERO RYA KACYIRU')
  const [title, setTitle] = useState(defaultTitle)
  const [subtitle, setSubtitle] = useState(monthLabel)
  const [headers, setHeaders] = useState(DEFAULT_HEADERS)
  const [weekBanners, setWeekBanners] = useState({})
  const [dateOverrides, setDateOverrides] = useState({})
  const [fallbackTitles, setFallbackTitles] = useState({})
  const [igaburoBanner, setIgaburoBanner] = useState(null)
  const [footerLines, setFooterLines] = useState([
    `Byateguwe na Minisiteri y'Abaririmbyi Itorero rya KACYIRU / ${monthUpper}`,
    "Byagenzuwe n'Umuyobozi Wungirije w'Itorero rya KACYIRU",
    "Byemejwe n'Umushumba w'Itorero ADEPR Kacyiru",
  ])

  useEffect(() => {
    setTitle(defaultTitle)
    setSubtitle(monthLabel)
    setFooterLines((prev) => {
      const next = [...prev]
      next[0] = `Byateguwe na Minisiteri y'Abaririmbyi Itorero rya KACYIRU / ${monthUpper}`
      return next
    })
  }, [defaultTitle, monthLabel, monthUpper])

  const withChoirs = useMemo(
    () => (assignments ?? []).filter((row) => assignmentHasChoirs(row, parseChoirList) || canEdit),
    [assignments, canEdit],
  )
  const regular = withChoirs.filter((row) => choirServiceBucket(row.service) !== 'igaburo')
  const igaburoRows = withChoirs.filter((row) => choirServiceBucket(row.service) === 'igaburo')
  const weeks = groupChoirByWeek(regular, year)

  const gridWeeks = []
  const fallbackRows = []

  weeks.forEach(([weekKey, items], weekIndex) => {
    const filled = items.filter(({ row }) => assignmentHasChoirs(row, parseChoirList) || canEdit)
    if (weekChoirGridReady(filled, parseChoirList) || (canEdit && filled.length > 0)) {
      gridWeeks.push({ weekKey, items: filled, weekIndex })
    } else {
      filled.forEach((item) => fallbackRows.push(item.row))
    }
  })

  const patchAssignmentChoirs = (matchRow, nameIndex, edited) => {
    if (!onAssignmentsChange || !matchRow) return
    const list = parseChoirList(matchRow.choirs)
    while (list.length <= nameIndex) list.push('')
    const prev = list[nameIndex]
    const next = normalizeEditedChoirName(edited, prev)
    list[nameIndex] = next
    const choirs = joinChoirList(list.filter(Boolean))
    onAssignmentsChange((prevRows) =>
      prevRows.map((row) => {
        if (rowKey(row) !== rowKey(matchRow) && !(row.service === matchRow.service && row.date === matchRow.date)) {
          return row
        }
        return { ...row, choirs, status: 'Assigned' }
      }),
    )
  }

  const patchBucketChoir = (weekItems, bucket, nameIndex, edited) => {
    const hit = weekItems.find(({ row }) => choirServiceBucket(row.service) === bucket)
    if (!hit) return
    patchAssignmentChoirs(hit.row, nameIndex, edited)
  }

  return (
    <article id={id} className="pmss-bulletin pmss-bulletin--choir">
      {canEdit && (
        <p className="pmss-bulletin-edit-hint pmss-no-print">
          Click any text to edit — church name, titles, week labels, dates, choir names, and footer.
        </p>
      )}
      <BulletinChurchHeader
        churchLine={
          <BulletinEditable
            value={churchLine}
            onChange={canEdit ? setChurchLine : undefined}
            disabled={!canEdit}
          />
        }
        title={
          <BulletinEditable
            value={title}
            onChange={canEdit ? setTitle : undefined}
            disabled={!canEdit}
          />
        }
        subtitle={
          <BulletinEditable
            value={subtitle}
            onChange={canEdit ? setSubtitle : undefined}
            disabled={!canEdit}
          />
        }
      />

      {gridWeeks.map(({ weekKey, items, weekIndex }) => {
        const defaultBanner = `${RW_WEEK[weekIndex + 1] ?? `WEEK ${weekIndex + 1}`} · ${weekRangeLabelFromItems(items)}`
        const banner = weekBanners[weekKey] ?? defaultBanner
        return (
          <section key={weekKey} className="pmss-choir-week-section">
            <div className="pmss-choir-week-banner">
              <BulletinEditable
                value={banner}
                onChange={canEdit ? (v) => setWeekBanners((b) => ({ ...b, [weekKey]: v })) : undefined}
                disabled={!canEdit}
              />
            </div>
            <table className="pmss-choir-grid">
              <thead>
                <tr>
                  <th className="pmss-choir-th pmss-choir-th--tue">
                    <BulletinEditable
                      value={headers.tue}
                      onChange={canEdit ? (v) => setHeaders((h) => ({ ...h, tue: v })) : undefined}
                      disabled={!canEdit}
                    />
                  </th>
                  <th className="pmss-choir-th pmss-choir-th--fri">
                    <BulletinEditable
                      value={headers.fri}
                      onChange={canEdit ? (v) => setHeaders((h) => ({ ...h, fri: v })) : undefined}
                      disabled={!canEdit}
                    />
                  </th>
                  <th className="pmss-choir-th pmss-choir-th--sun" colSpan={2}>
                    <BulletinEditable
                      value={headers.sun}
                      onChange={canEdit ? (v) => setHeaders((h) => ({ ...h, sun: v })) : undefined}
                      disabled={!canEdit}
                    />
                  </th>
                </tr>
                <tr>
                  {['tuesday', 'friday'].map((bucket) => (
                    <th key={bucket} className="pmss-choir-th-sub">
                      <BulletinEditable
                        value={dateOverrides[`${weekKey}-${bucket}`] ?? cellDate(items, bucket)}
                        onChange={
                          canEdit
                            ? (v) => setDateOverrides((d) => ({ ...d, [`${weekKey}-${bucket}`]: v }))
                            : undefined
                        }
                        disabled={!canEdit}
                      />
                    </th>
                  ))}
                  <th className="pmss-choir-th-sub pmss-choir-th--ss1">
                    <BulletinEditable
                      value={headers.ss1}
                      onChange={canEdit ? (v) => setHeaders((h) => ({ ...h, ss1: v })) : undefined}
                      disabled={!canEdit}
                    />
                  </th>
                  <th className="pmss-choir-th-sub pmss-choir-th--ss2">
                    <BulletinEditable
                      value={headers.ss2}
                      onChange={canEdit ? (v) => setHeaders((h) => ({ ...h, ss2: v })) : undefined}
                      disabled={!canEdit}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {['tuesday', 'friday', 'sunday1', 'sunday2'].map((bucket) => (
                    <ChoirCell
                      key={bucket}
                      names={choirsForBucket(items, bucket)}
                      canEdit={canEdit}
                      displayShort={!canEdit}
                      onNameChange={(i, v) => patchBucketChoir(items, bucket, i, v)}
                    />
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        )
      })}

      {fallbackRows.length > 0 && (
        <section className="pmss-choir-fallback-section">
          {fallbackRows.map((row) => (
            <ChoirServiceFallback
              key={rowKey(row)}
              row={row}
              year={year}
              canEdit={canEdit}
              titleOverride={fallbackTitles[rowKey(row)]}
              onTitleChange={(v) => setFallbackTitles((t) => ({ ...t, [rowKey(row)]: v }))}
              onChoirChange={(i, v) => patchAssignmentChoirs(row, i, v)}
            />
          ))}
        </section>
      )}

      {igaburoRows.length > 0 && (
        <section className="pmss-choir-igaburo">
          <div className="pmss-choir-igaburo-banner">
            <BulletinEditable
              value={
                igaburoBanner ??
                `${headers.igaburo}${
                  igaburoRows[0]?.date
                    ? ` · ${formatBulletinDateSlash(parseBulletinDateParts(igaburoRows[0].date, year))}`
                    : ''
                }`
              }
              onChange={canEdit ? setIgaburoBanner : undefined}
              disabled={!canEdit}
            />
          </div>
          <table className="pmss-choir-grid pmss-choir-grid--igaburo">
            <tbody>
              {igaburoRows.flatMap((row) => {
                const names = parseChoirList(row.choirs)
                const list = names.length ? names : canEdit ? [''] : []
                return list.map((name, i) => (
                  <tr key={`${rowKey(row)}-${i}`}>
                    <td className="pmss-choir-cell">
                      {canEdit ? (
                        <BulletinEditable
                          value={name}
                          placeholder="Choir"
                          onChange={(v) => patchAssignmentChoirs(row, i, v)}
                        />
                      ) : (
                        <>Chorale {shortChoirDisplayName(name)}</>
                      )}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </section>
      )}

      <footer className="pmss-bulletin-signatures">
        {footerLines.map((line, i) => (
          <p key={i}>
            <BulletinEditable
              value={line}
              onChange={
                canEdit
                  ? (v) =>
                      setFooterLines((lines) => {
                        const next = [...lines]
                        next[i] = v
                        return next
                      })
                  : undefined
              }
              disabled={!canEdit}
            />
          </p>
        ))}
      </footer>
    </article>
  )
}
