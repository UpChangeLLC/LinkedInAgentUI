interface SectionHeaderProps {
  label: string;
  title: string;
  subtitle?: string;
}

export function SectionHeader({ label, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-dark-accent">
        {label}
      </span>
      <h2 className="text-2xl font-bold font-serif text-dark-textPri mt-1">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-dark-textMuted mt-1">{subtitle}</p>
      )}
    </div>
  );
}
