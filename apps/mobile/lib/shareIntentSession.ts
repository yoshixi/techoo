/**
 * The share composer stays open while a share payload is pending.
 * Dismissing it (post, cancel, or system back) must stick until that payload clears,
 * otherwise the redirect would open the composer again.
 */
let dismissed = false;

export function dismissShareIntentSession(): void {
  dismissed = true;
}

export function armShareIntentSession(): void {
  dismissed = false;
}

export function isShareIntentSessionDismissed(): boolean {
  return dismissed;
}
