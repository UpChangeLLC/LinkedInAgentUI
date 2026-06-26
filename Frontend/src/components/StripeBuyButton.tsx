import { useEffect } from 'react'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

const BUY_BUTTON_SCRIPT = 'https://js.stripe.com/v3/buy-button.js'

// <stripe-buy-button> is a Stripe-provided custom element, so teach JSX about it.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'buy-button-id'?: string
        'publishable-key'?: string
        'client-reference-id'?: string
        'customer-email'?: string
      }
    }
  }
}

interface StripeBuyButtonProps {
  buyButtonId: string
  publishableKey: string
  /** Stripe echoes this back on the checkout.session.completed webhook so the
   *  backend can map the payment to a user. We pass the signup id (UUID). */
  clientReferenceId?: string
  customerEmail?: string
}

/** Embeds Stripe's hosted Buy Button. Activation happens server-side via the
 *  Stripe webhook (see routes/stripe_webhooks.py); this only renders checkout. */
export function StripeBuyButton({
  buyButtonId,
  publishableKey,
  clientReferenceId,
  customerEmail,
}: StripeBuyButtonProps) {
  useEffect(() => {
    if (document.querySelector(`script[src="${BUY_BUTTON_SCRIPT}"]`)) return
    const script = document.createElement('script')
    script.src = BUY_BUTTON_SCRIPT
    script.async = true
    document.head.appendChild(script)
  }, [])

  return (
    <stripe-buy-button
      buy-button-id={buyButtonId}
      publishable-key={publishableKey}
      {...(clientReferenceId ? { 'client-reference-id': clientReferenceId } : {})}
      {...(customerEmail ? { 'customer-email': customerEmail } : {})}
    />
  )
}
