import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthPasswordField({
  id = 'password',
  value,
  onChange,
  placeholder = 'Enter password',
  autoComplete = 'current-password',
  required,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="pmss-auth-password-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="pmss-auth-password-input"
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
      />
      <button
        type="button"
        className="pmss-auth-password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={2} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={2} />}
      </button>
    </div>
  )
}
