/**
 * Formats an amount with the correct unit (sat/sats)
 * @param amount - The amount as bigint, number, or string
 * @returns The formatted string with amount and correct unit
 */
export function formatSats(amount: bigint | number | string): string {
  const numericAmount = typeof amount === 'bigint' ? Number(amount) : Number(amount);
  const unit = (numericAmount === 0 || numericAmount === 1) ? 'sat' : 'sats';
  return `${amount.toString()} ${unit}`;
}

/**
 * Gets just the unit (sat/sats) for an amount
 * @param amount - The amount as bigint, number, or string
 * @returns 'sat' for amount of 0 or 1, 'sats' for all other amounts
 */
export function getSatUnit(amount: bigint | number | string): string {
  const numericAmount = typeof amount === 'bigint' ? Number(amount) : Number(amount);
  return (numericAmount === 0 || numericAmount === 1) ? 'sat' : 'sats';
} 