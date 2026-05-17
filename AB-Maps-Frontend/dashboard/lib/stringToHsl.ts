/**
 * Deterministic name → HSL background colour for initials avatars.
 * Uses a 32-bit string hash to pick a hue in [0, 360). Saturation + lightness
 * are calibrated for both themes so the colour reads as a tint, not a flag.
 *
 *   const bg = stringToHsl('Lukas Blohne')           // light theme
 *   const bg = stringToHsl('Lukas Blohne', { dark }) // adjusts lightness
 */
export function stringToHsl(
  input: string,
  opts: { dark?: boolean; saturation?: number; lightness?: number } = {},
): string {
  const { dark = false, saturation, lightness } = opts
  if (!input) return dark ? "hsl(220 6% 18%)" : "hsl(220 6% 92%)"

  // Simple 32-bit FNV-ish hash — stable across server/client
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  const hue = Math.abs(h) % 360
  const sat = saturation ?? (dark ? 38 : 60)
  const lit = lightness ?? (dark ? 38 : 88)
  return `hsl(${hue} ${sat}% ${lit}%)`
}

/** Text colour to pair with the background — keeps WCAG contrast reasonable. */
export function stringToHslText(input: string, dark = false): string {
  const h = (() => {
    let x = 0
    for (let i = 0; i < input.length; i++) {
      x = (x << 5) - x + input.charCodeAt(i)
      x |= 0
    }
    return Math.abs(x) % 360
  })()
  return dark ? `hsl(${h} 35% 78%)` : `hsl(${h} 50% 28%)`
}
