interface QuestionCardProps {
  index: number
  total: number
  /** Dimension label shown above the question (e.g. "D-AI", "D-NR"). */
  dim?: string
  question: string
  helpText?: string
  optional?: boolean
  children: React.ReactNode
}

/** Mock §SCREEN 3: white card per question, with a dimension label, the
 * question, optional help text, and the input control. */
export function QuestionCard({ index, total, dim, question, helpText, optional, children }: QuestionCardProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-white shadow-sm p-7">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-linkedin">
        {dim ? `${dim} · ` : ''}Question {index} of {total}
      </div>
      <h2 className="mt-2 text-xl font-bold leading-snug text-gray-900">
        {question}
        {optional && <span className="ml-2 text-xs font-normal text-gray-500">(optional)</span>}
      </h2>
      {helpText && <p className="mt-2 text-sm text-gray-500">{helpText}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}
