interface Props {
  icon: string
  title: string
  subtitle: string
}

export default function PageHead({ icon, title, subtitle }: Props) {
  return (
    <div className="page-head">
      <h1>
        {icon} {title}
      </h1>
      <p className="subtitle">{subtitle}</p>
    </div>
  )
}