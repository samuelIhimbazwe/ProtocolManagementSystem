/** Inline editable text — click to edit; commits on blur. */
export default function BulletinEditable({
  as: Comp = 'span',
  value = '',
  onChange,
  className = '',
  disabled = false,
  multiline = false,
  placeholder = '',
}) {
  if (disabled || !onChange) {
    return <Comp className={className}>{value || placeholder}</Comp>
  }

  return (
    <Comp
      key={value}
      className={`pmss-bulletin-editable ${className}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline || undefined}
      data-placeholder={placeholder}
      onBlur={(e) => {
        const next = (multiline ? e.currentTarget.innerText : e.currentTarget.textContent)?.replace(
          /\u00a0/g,
          ' ',
        )
        const trimmed = String(next ?? '').replace(/\n+$/, '')
        if (trimmed !== value) onChange(trimmed)
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    >
      {value}
    </Comp>
  )
}
