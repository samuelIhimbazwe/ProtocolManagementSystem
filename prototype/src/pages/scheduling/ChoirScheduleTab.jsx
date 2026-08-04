import { useMemo, useState } from 'react'
import DisplayFormatToggle from '../../components/DisplayFormatToggle'
import ChoirScheduleBulletin from '../../components/bulletin/ChoirScheduleBulletin'
import ChoirScheduleList from '../../components/list/ChoirScheduleList'
import ChoirAssignmentItems from '../../components/ChoirAssignmentItems'
import { useDisplayFormat } from '../../hooks/useDisplayFormat'
import { RefreshCw } from 'lucide-react'
import { ServiceCard, Badge } from '../../layouts/AppShell'
import ChoirServiceToolbar from '../../components/ChoirServiceToolbar'
import Modal from '../../components/Modal'
import {
  allChoirOptions,
  joinChoirList,
  parseChoirList,
  regenerateChoirsForService,
} from '../../components/ChoirCardActions'
import { CHOIR_ASSIGNMENTS, CHOIRS } from '../../data/mock'
import {
  downloadChoirScheduleCsv,
  downloadChoirScheduleExcel,
  downloadChoirSchedulePdf,
} from '../../lib/choirScheduleExport'
import { downloadBulletinPdf } from '../../lib/bulletinPdf'
import ScheduleDownloadMenu from '../../components/ScheduleDownloadMenu'

function choirKey(c, i) {
  return `${c.service}-${c.date}-${i}`
}

export default function ChoirScheduleTab({
  canEdit,
  showToast,
  controlledAssignments,
  onAssignmentsChange,
  monthLabel = 'August 2026',
}) {
  const [format, setFormat] = useDisplayFormat('pmss-view-choir', 'cards')
  const [internal, setInternal] = useState(() =>
    CHOIR_ASSIGNMENTS.map((c, i) => ({ ...c, _key: choirKey(c, i) })),
  )
  const assignments = controlledAssignments ?? internal
  const setAssignments = onAssignmentsChange ?? setInternal
  const [modal, setModal] = useState(null)
  const [replaceFrom, setReplaceFrom] = useState('')
  const [replaceTo, setReplaceTo] = useState('')
  const [addChoirPick, setAddChoirPick] = useState('')
  const [removeChoirPick, setRemoveChoirPick] = useState('')

  const choirOptions = useMemo(() => allChoirOptions(CHOIRS), [])

  const active = modal != null ? assignments[modal.index] : null

  const patchAssignment = (index, patch) => {
    setAssignments((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch, status: 'Assigned' } : row)))
  }

  const openEditMenu = (index) => {
    setModal({ index, type: 'edit-menu' })
  }

  const openAddModal = (index) => {
    const list = parseChoirList(assignments[index].choirs)
    const pick = choirOptions.find((c) => !list.includes(c)) ?? ''
    setAddChoirPick(pick)
    setModal({ index, type: 'add' })
  }

  const openRemoveModal = (index, choirName) => {
    const list = parseChoirList(assignments[index].choirs)
    setRemoveChoirPick(choirName ?? list[0] ?? '')
    setModal({ index, type: 'remove' })
  }

  const openReplaceModal = (index, choirName, fromEditMenu = false) => {
    const row = assignments[index]
    const list = parseChoirList(row.choirs)
    const from = choirName ?? list[0] ?? ''
    const pickTo =
      choirOptions.find((c) => c !== from && !list.includes(c)) ??
      choirOptions.find((c) => c !== from) ??
      choirOptions[0] ??
      ''
    setModal({ index, type: 'replace', fromEditMenu: fromEditMenu || false })
    setReplaceFrom(from)
    setReplaceTo(pickTo)
  }

  const removeChoir = (index, choirName) => {
    const list = parseChoirList(assignments[index].choirs)
    if (list.length <= 1) {
      showToast('Each service needs at least one choir')
      return
    }
    const next = list.filter((c) => c !== choirName)
    patchAssignment(index, { choirs: joinChoirList(next) })
    showToast(`Removed ${choirName}`)
  }

  const regenerateRow = (index) => {
    const row = assignments[index]
    const choirs = regenerateChoirsForService(row.service, CHOIRS)
    patchAssignment(index, { choirs })
    showToast(`Regenerated choirs for ${row.service} (${row.date})`)
  }

  const closeModal = () => setModal(null)

  const saveAdd = () => {
    if (!addChoirPick) {
      showToast('Choose a choir to add')
      return
    }
    const list = parseChoirList(assignments[modal.index].choirs)
    if (list.includes(addChoirPick)) {
      showToast(`${addChoirPick} is already on this service`)
      return
    }
    patchAssignment(modal.index, { choirs: joinChoirList([...list, addChoirPick]) })
    showToast(`Added ${addChoirPick}`)
    closeModal()
  }

  const saveRemove = () => {
    if (!removeChoirPick) return
    removeChoir(modal.index, removeChoirPick)
    closeModal()
  }

  const saveReplace = () => {
    if (!replaceFrom || !replaceTo) return
    if (replaceFrom === replaceTo) {
      showToast('Pick a different choir')
      return
    }
    const list = parseChoirList(assignments[modal.index].choirs)
    const idx = list.indexOf(replaceFrom)
    if (idx === -1) {
      showToast('Selected choir not found on this service')
      return
    }
    if (list.includes(replaceTo)) {
      showToast(`${replaceTo} is already on this service`)
      return
    }
    list[idx] = replaceTo
    patchAssignment(modal.index, { choirs: joinChoirList(list) })
    showToast(`Replaced ${replaceFrom} with ${replaceTo}`)
    closeModal()
  }

  const regenerateAll = () => {
    setAssignments((prev) =>
      prev.map((row) => ({
        ...row,
        choirs: regenerateChoirsForService(row.service, CHOIRS),
        status: 'Assigned',
      })),
    )
    showToast('Full choir schedule regenerated')
  }

  const downloadSchedule = async (format) => {
    if (assignments.length === 0) {
      showToast('No choir assignments to download')
      return
    }
    try {
      if (format === 'csv') {
        downloadChoirScheduleCsv(assignments, { monthLabel })
        showToast('Choir schedule downloaded (CSV)')
      } else if (format === 'excel') {
        downloadChoirScheduleExcel(assignments, { monthLabel })
        showToast('Choir schedule downloaded (Excel)')
      } else if (format === 'pdf') {
        let result
        if (document.getElementById('choir-bulletin')) {
          result = await downloadBulletinPdf('choir-bulletin', {
            title: 'Choir schedule bulletin',
            fileName: 'pmss-choir-schedule-bulletin.pdf',
          })
        } else {
          result = await downloadChoirSchedulePdf(assignments, { monthLabel })
        }
        showToast(`Downloaded ${result?.fileName ?? 'bulletin.pdf'}`)
      }
    } catch (err) {
      showToast(err.message ?? 'Download failed')
    }
  }

  const replaceOptions = useMemo(() => {
    if (!active) return choirOptions
    const onService = new Set(parseChoirList(active.choirs))
    return choirOptions.filter((c) => c !== replaceFrom && !onService.has(c))
  }, [active, choirOptions, replaceFrom])

  const addOptions = useMemo(() => {
    if (!active) return choirOptions
    const onService = new Set(parseChoirList(active.choirs))
    return choirOptions.filter((c) => !onService.has(c))
  }, [active, choirOptions])

  const removeOptions = useMemo(() => {
    if (!active) return []
    return parseChoirList(active.choirs)
  }, [active])

  const serviceDescription = active ? `${active.service} · ${active.date}` : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pmss-no-print">
        <DisplayFormatToggle
          format={format}
          onChange={setFormat}
          bulletinId="choir-bulletin"
          bulletinTitle="Choir schedule bulletin"
          onToast={showToast}
        />
      </div>

      <div className="flex flex-wrap gap-2 pmss-no-print">
        {canEdit && (
          <>
            <button
              type="button"
              className="pmss-btn-primary"
              onClick={() => {
                setAssignments(CHOIR_ASSIGNMENTS.map((c, i) => ({ ...c, _key: choirKey(c, i) })))
                showToast('Choir schedule generated')
              }}
            >
              Generate choir schedule
            </button>
            <button type="button" className="pmss-btn-secondary" onClick={regenerateAll}>
              <RefreshCw className="w-4 h-4" /> Regenerate schedule
            </button>
          </>
        )}
        <ScheduleDownloadMenu
          onExport={downloadSchedule}
          disabled={assignments.length === 0}
        />
      </div>

      {format !== 'bulletin' && (
        <div className="pmss-offscreen-export" aria-hidden="true">
          <ChoirScheduleBulletin id="choir-bulletin" assignments={assignments} />
        </div>
      )}
      {format === 'bulletin' ? (
        <ChoirScheduleBulletin id="choir-bulletin" assignments={assignments} />
      ) : format === 'list' ? (
        <ChoirScheduleList
          assignments={assignments}
          canEdit={canEdit}
          onRegenerate={regenerateRow}
          onEdit={openEditMenu}
          onRemoveChoir={removeChoir}
          onReplaceChoir={openReplaceModal}
        />
      ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map((c, i) => (
          <ServiceCard
            key={c._key}
            title={c.service}
            date={c.date}
            actions={
              canEdit ? (
                <ChoirServiceToolbar onRegenerate={() => regenerateRow(i)} onEdit={() => openEditMenu(i)} />
              ) : null
            }
          >
            <ChoirAssignmentItems
              choirs={c.choirs}
              canEdit={canEdit}
              onRemove={(name) => removeChoir(i, name)}
              onReplace={(name) => openReplaceModal(i, name)}
            />
            <Badge variant={c.status === 'Assigned' ? 'success' : 'warning'}>{c.status}</Badge>
          </ServiceCard>
        ))}
      </div>
      )}

      <Modal
        open={modal?.type === 'edit-menu'}
        onClose={closeModal}
        title="Edit choirs"
        description={serviceDescription}
        footer={
          <button type="button" className="pmss-btn-secondary" onClick={closeModal}>
            Close
          </button>
        }
      >
        <p className="text-sm text-neutral-600 mb-4">Choose what you want to change for this service.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="pmss-btn-primary flex-1"
            onClick={() => openAddModal(modal.index)}
            disabled={addOptions.length === 0}
          >
            Add choir
          </button>
          <button
            type="button"
            className="pmss-btn-secondary flex-1"
            onClick={() => openRemoveModal(modal.index)}
            disabled={removeOptions.length <= 1}
          >
            Remove choir
          </button>
          <button
            type="button"
            className="pmss-btn-outline-accent flex-1"
            onClick={() => openReplaceModal(modal.index, undefined, true)}
            disabled={
              removeOptions.length === 0 ||
              choirOptions.filter((c) => !new Set(parseChoirList(active?.choirs ?? '')).has(c)).length === 0
            }
          >
            Replace choir
          </button>
        </div>
        {addOptions.length === 0 && (
          <p className="text-xs text-neutral-500 mt-3">All catalog choirs are already assigned to this service.</p>
        )}
      </Modal>

      <Modal
        open={modal?.type === 'add'}
        onClose={closeModal}
        title="Add choir"
        description={serviceDescription}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setModal({ index: modal.index, type: 'edit-menu' })}>
              Back
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveAdd} disabled={!addChoirPick}>
              Add
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Choir to add</label>
        <select className="pmss-input" value={addChoirPick} onChange={(e) => setAddChoirPick(e.target.value)}>
          {addOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Modal>

      <Modal
        open={modal?.type === 'remove'}
        onClose={closeModal}
        title="Remove choir"
        description={serviceDescription}
        footer={
          <>
            <button type="button" className="pmss-btn-secondary" onClick={() => setModal({ index: modal.index, type: 'edit-menu' })}>
              Back
            </button>
            <button type="button" className="pmss-btn-chip pmss-btn-chip-danger h-10 px-5" onClick={saveRemove}>
              Remove
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Choir to remove</label>
        <select className="pmss-input" value={removeChoirPick} onChange={(e) => setRemoveChoirPick(e.target.value)}>
          {removeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {removeOptions.length <= 1 && (
          <p className="text-xs text-neutral-500 mt-2">At least one choir must stay on this service.</p>
        )}
      </Modal>

      <Modal
        open={modal?.type === 'replace'}
        onClose={closeModal}
        title="Replace choir"
        description={serviceDescription}
        footer={
          <>
            <button
              type="button"
              className="pmss-btn-secondary"
              onClick={() =>
                modal?.fromEditMenu ? setModal({ index: modal.index, type: 'edit-menu' }) : closeModal()
              }
            >
              {modal?.fromEditMenu ? 'Back' : 'Cancel'}
            </button>
            <button type="button" className="pmss-btn-primary" onClick={saveReplace} disabled={!replaceTo}>
              Replace
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Replace</label>
            <select
              className="pmss-input"
              value={replaceFrom}
              onChange={(e) => {
                const from = e.target.value
                setReplaceFrom(from)
                const onService = new Set(parseChoirList(active.choirs))
                const nextTo =
                  choirOptions.find((c) => c !== from && !onService.has(c)) ??
                  choirOptions.find((c) => c !== from) ??
                  ''
                setReplaceTo(nextTo)
              }}
            >
              {removeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">With</label>
            <select className="pmss-input" value={replaceTo} onChange={(e) => setReplaceTo(e.target.value)}>
              {replaceOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
