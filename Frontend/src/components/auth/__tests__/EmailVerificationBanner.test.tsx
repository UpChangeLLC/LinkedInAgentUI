import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmailVerificationBanner } from '../EmailVerificationBanner'

describe('EmailVerificationBanner', () => {
  it('shows the verify nag with the email and a resend button', () => {
    render(<EmailVerificationBanner email="me@example.com" onResend={vi.fn().mockResolvedValue(true)} />)
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument()
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend email/i })).toBeInTheDocument()
  })

  it('calls onResend and shows confirmation on success', async () => {
    const onResend = vi.fn().mockResolvedValue(true)
    render(<EmailVerificationBanner email="me@example.com" onResend={onResend} />)
    fireEvent.click(screen.getByRole('button', { name: /resend email/i }))
    expect(onResend).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument())
  })

  it('can be dismissed', () => {
    render(<EmailVerificationBanner email="me@example.com" onResend={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument()
  })
})
