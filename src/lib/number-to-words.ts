// Converte números para extenso em português brasileiro (valores monetários)

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function grupoParaExtenso(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const d = Math.floor((n % 100) / 10)
  const u = n % 10
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c])
  if (d === 1) {
    partes.push(DEZ_A_DEZENOVE[u])
  } else {
    if (d > 0) partes.push(DEZENAS[d])
    if (u > 0) partes.push(UNIDADES[u])
  }
  return partes.join(' e ')
}

function inteiroParaExtenso(n: number): string {
  if (n === 0) return 'zero'
  if (n < 0) return 'menos ' + inteiroParaExtenso(-n)

  const bilhoes = Math.floor(n / 1_000_000_000)
  const milhoes = Math.floor((n % 1_000_000_000) / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  const partes: string[] = []
  if (bilhoes > 0) partes.push(grupoParaExtenso(bilhoes) + (bilhoes === 1 ? ' bilhão' : ' bilhões'))
  if (milhoes > 0) partes.push(grupoParaExtenso(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'))
  if (milhares > 0) {
    if (milhares === 1) partes.push('mil')
    else partes.push(grupoParaExtenso(milhares) + ' mil')
  }
  if (resto > 0) partes.push(grupoParaExtenso(resto))
  return partes.join(' e ')
}

/**
 * Converte valor monetário em reais para extenso.
 * Ex: 1234.56 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"
 */
export function numberToWordsBR(value: number): string {
  const rounded = Math.round(value * 100) / 100
  const reais = Math.floor(rounded)
  const centavos = Math.round((rounded - reais) * 100)

  const partes: string[] = []
  if (reais > 0) {
    partes.push(inteiroParaExtenso(reais) + (reais === 1 ? ' real' : ' reais'))
  }
  if (centavos > 0) {
    if (partes.length > 0) partes.push('e')
    partes.push(inteiroParaExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos'))
  }
  if (partes.length === 0) return 'zero real'
  return partes.join(' ')
}
