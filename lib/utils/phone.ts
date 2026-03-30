/** Returns last 4 digits of a phone number for display, e.g. "4255551234" → "1234" */
export function phoneLast4(phoneNumber: string): string {
  return phoneNumber.slice(-4)
}

/** Display format: "•••• 1234" */
export function phoneDisplay(phoneNumber: string): string {
  return `•••• ${phoneLast4(phoneNumber)}`
}
