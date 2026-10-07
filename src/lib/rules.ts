/** Normaliza nombres de comercio para poder compararlos ("RAPPI*123 BOGOTÁ" -> "rappi 123 bogota"). */
export function normalizeMerchant(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Palabras clave comunes en Colombia -> id de categoría por defecto. */
const KEYWORDS: [string, string][] = [
  ['exito', 'mercado'],
  ['carulla', 'mercado'],
  ['d1', 'mercado'],
  ['ara', 'mercado'],
  ['jumbo', 'mercado'],
  ['olimpica', 'mercado'],
  ['makro', 'mercado'],
  ['pricesmart', 'mercado'],
  ['rappi', 'restaurantes'],
  ['ifood', 'restaurantes'],
  ['didi food', 'restaurantes'],
  ['restaurante', 'restaurantes'],
  ['crepes', 'restaurantes'],
  ['juan valdez', 'restaurantes'],
  ['starbucks', 'restaurantes'],
  ['uber', 'transporte'],
  ['didi', 'transporte'],
  ['cabify', 'transporte'],
  ['indriver', 'transporte'],
  ['terpel', 'transporte'],
  ['primax', 'transporte'],
  ['texaco', 'transporte'],
  ['peaje', 'transporte'],
  ['parqueadero', 'transporte'],
  ['netflix', 'suscripciones'],
  ['spotify', 'suscripciones'],
  ['youtube', 'suscripciones'],
  ['apple com', 'suscripciones'],
  ['icloud', 'suscripciones'],
  ['disney', 'suscripciones'],
  ['hbo', 'suscripciones'],
  ['max com', 'suscripciones'],
  ['prime video', 'suscripciones'],
  ['chatgpt', 'suscripciones'],
  ['openai', 'suscripciones'],
  ['claude', 'suscripciones'],
  ['anthropic', 'suscripciones'],
  ['smart fit', 'salud'],
  ['smartfit', 'salud'],
  ['bodytech', 'salud'],
  ['drogueria', 'salud'],
  ['cruz verde', 'salud'],
  ['farmatodo', 'salud'],
  ['colsanitas', 'salud'],
  ['sura', 'salud'],
  ['epm', 'servicios'],
  ['enel', 'servicios'],
  ['codensa', 'servicios'],
  ['vanti', 'servicios'],
  ['acueducto', 'servicios'],
  ['claro', 'servicios'],
  ['movistar', 'servicios'],
  ['tigo', 'servicios'],
  ['etb', 'servicios'],
  ['arriendo', 'vivienda'],
  ['administracion', 'vivienda'],
  ['amazon', 'compras'],
  ['mercadolibre', 'compras'],
  ['mercado libre', 'compras'],
  ['falabella', 'compras'],
  ['zara', 'compras'],
  ['avianca', 'viajes'],
  ['latam', 'viajes'],
  ['airbnb', 'viajes'],
  ['booking', 'viajes'],
  ['cine', 'entretenimiento'],
  ['cinecolombia', 'entretenimiento'],
  ['procinal', 'entretenimiento'],
  ['nomina', 'salario'],
  ['salario', 'salario'],
  ['pago nomina', 'salario'],
]

const hasWord = (haystack: string, needle: string) => ` ${haystack} `.includes(` ${needle} `)

/**
 * Sugiere categoría para un comercio:
 * 1) lo que el usuario ya eligió antes para ese comercio (reglas aprendidas)
 * 2) palabras clave por defecto
 */
export function suggestCategory(
  name: string,
  rules: Record<string, string>,
  validIds: Set<string>,
): string | null {
  const n = normalizeMerchant(name)
  if (!n) return null
  if (rules[n] && validIds.has(rules[n])) return rules[n]

  // Regla aprendida contenida en la descripción (útil para extractos: "COMPRA RAPPI 123")
  let best: [string, string] | null = null
  for (const [key, cat] of Object.entries(rules)) {
    if (key.length >= 4 && validIds.has(cat) && hasWord(n, key) && (!best || key.length > best[0].length)) {
      best = [key, cat]
    }
  }
  if (best) return best[1]

  for (const [kw, cat] of KEYWORDS) {
    if (validIds.has(cat) && hasWord(n, kw)) return cat
  }
  return null
}
