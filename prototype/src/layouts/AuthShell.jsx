import { Church } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="pmss-auth-page flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <Link to="/login" className="inline-flex flex-col items-center group">
              <div className="inline-flex w-14 h-14 rounded-auth bg-primary-700 text-white items-center justify-center mb-4 shadow-auth group-hover:bg-primary-800 transition-colors">
                <Church className="w-7 h-7" strokeWidth={1.75} />
              </div>
              <span className="pmss-auth-title text-lg !tracking-[0.14em]">PMSS</span>
            </Link>
            <p className="text-sm text-neutral-500 mt-2 leading-relaxed">Protocol Management & Scheduling System</p>
            {title && (
              <h2 className="pmss-auth-title text-base mt-6 tracking-[0.08em]">{title}</h2>
            )}
            {subtitle && <p className="text-sm text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">{subtitle}</p>}
          </div>

          {children}

          {footer}
        </div>
      </div>
    </div>
  )
}
