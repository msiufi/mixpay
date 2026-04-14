// Number formatting — Argentine locale (. for thousands, , for decimals)

const LOCALE = 'es-AR'

/** Format a money amount with $ prefix: $1.234,56 */
export function fmt(value: number, decimals = 2): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
