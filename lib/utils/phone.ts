export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '')
}

export function phoneLast4(phoneNumber: string): string {
  return phoneNumber.slice(-4)
}

export function phoneDisplay(phoneNumber: string): string {
  return `•••• ${phoneLast4(phoneNumber)}`
}
