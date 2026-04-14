// Number formatting — Argentine locale (. for thousands, , for decimals)

const LOCALE = 'es-AR'

/** Format a money amount: $1.234,56 for ARS, $5,00 for USD */
export const fmt = formatMoney
export function formatMoney(value: number, decimals = 2): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format with no decimals: 14.000 */
export function formatInteger(value: number): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
