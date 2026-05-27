interface QuestionCardProps {
  index: number
  total: number
  question: string
  helpText?: string
  optional?: boolean
  children: React.ReactNode
}

/** Wrapper for one survey question: number, prompt, optional help text, control. */
export function QuestionCard({ index, total, question, helpText, optional, children }: QuestionCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-1 text-xs font-medium text-white/40">
        Question {index} of {total}
      </div>
      <h2 className="text-base font-semibold text-white">
        {question}
        {optional && <span className="ml-2 text-xs font-normal text-white/40">(optional)</span>}
      </h2>
      {helpText && <p className="mt-1 text-sm text-white/50">{helpText}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}
