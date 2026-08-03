/** Shared masthead matching ADEPR Kacyiru bulletin samples */
const LOGO_SRC = `${import.meta.env.BASE_URL}images/adepr-kacyiru-logo.png`

export default function BulletinChurchHeader({ churchLine = 'ADEPR KACYIRU', title, subtitle }) {
  return (
    <header className="pmss-bulletin-masthead">
      <img src={LOGO_SRC} alt="" className="pmss-bulletin-logo-img" width={88} height={88} />
      {churchLine != null && churchLine !== false && (
        <p className="pmss-bulletin-church-line">{churchLine}</p>
      )}
      {title != null && title !== false && <h1 className="pmss-bulletin-main-title">{title}</h1>}
      {subtitle ? <p className="pmss-bulletin-subtitle">{subtitle}</p> : null}
    </header>
  )
}
