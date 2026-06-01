// AI-tools catalog for Q-AI-1 (spec 01 §4.2). Edit here without touching code.
// Keys are stable ids sent to the backend (q_ai_1 is a {toolKey: frequency} map).

export interface AiTool {
  key: string
  label: string
}

export const AI_TOOLS: AiTool[] = [
  { key: 'chatgpt', label: 'ChatGPT' },
  { key: 'claude', label: 'Claude' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'copilot', label: 'Copilot (GitHub / Microsoft 365)' },
  { key: 'perplexity', label: 'Perplexity' },
  { key: 'image_gen', label: 'Image generation (Midjourney / DALL·E / SD)' },
  { key: 'productivity_ai', label: 'Productivity AI (Notion AI / Mem / similar)' },
  { key: 'dev_tools', label: 'Dev tools (Cursor / Codeium / Tabnine)' },
  { key: 'other', label: 'Other' },
]
