// Os limites são aplicados na entrada, enquanto os resultados mantêm todas as casas.
export const DECIMAL_PATTERN = /^\d{1,12}(?:[.,]\d{1,18})?$/u;
export const PRESENTATION_SCALE = 4;

interface Decimal {
  coefficient: bigint;
  scale: number;
}

function parse(value: string): Decimal {
  const [whole, fractional = ''] = value.replace(',', '.').split('.');
  return { coefficient: BigInt(`${whole}${fractional}`), scale: fractional.length };
}

function render({ coefficient, scale }: Decimal): string {
  const digits = coefficient.toString().padStart(scale + 1, '0');
  if (!scale) return digits;
  const fractional = digits.slice(-scale).replace(/0+$/, '');
  return fractional ? `${digits.slice(0, -scale)}.${fractional}` : digits.slice(0, -scale);
}

export function normalizeDecimal(value: string): string {
  return render(parse(value));
}

export function addDecimals(left: string, right: string): string {
  const a = parse(left);
  const b = parse(right);
  const scale = Math.max(a.scale, b.scale);
  return render({
    coefficient: a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale),
    scale,
  });
}

export function multiplyDecimals(left: string, right: string): string {
  const a = parse(left);
  const b = parse(right);
  return render({ coefficient: a.coefficient * b.coefficient, scale: a.scale + b.scale });
}

export function differenceDecimals(left: string, right: string): string {
  const a = parse(left);
  const b = parse(right);
  const scale = Math.max(a.scale, b.scale);
  const difference = a.coefficient * 10n ** BigInt(scale - a.scale) - b.coefficient * 10n ** BigInt(scale - b.scale);
  return (difference < 0n ? '-' : '') + render({ coefficient: difference < 0n ? -difference : difference, scale });
}

export function divideDecimals(left: string, right: string, scale: number): string {
  const a = parse(left);
  const b = parse(right);
  return render({
    coefficient: (a.coefficient * 10n ** BigInt(b.scale + scale)) / (b.coefficient * 10n ** BigInt(a.scale)),
    scale,
  });
}

export function ceilingMinutes(value: string): bigint {
  const { coefficient, scale } = parse(value);
  const unit = 10n ** BigInt(scale);
  return (coefficient + unit - 1n) / unit;
}

export function formatDecimal(value: string, scale = PRESENTATION_SCALE, separator = ','): string {
  const { coefficient, scale: sourceScale } = parse(value);
  const digits = scale < sourceScale
    ? (coefficient + 5n * 10n ** BigInt(sourceScale - scale - 1)) / 10n ** BigInt(sourceScale - scale)
    : coefficient * 10n ** BigInt(scale - sourceScale);
  const padded = digits.toString().padStart(scale + 1, '0');
  return scale ? `${padded.slice(0, -scale)}${separator}${padded.slice(-scale)}` : padded;
}
