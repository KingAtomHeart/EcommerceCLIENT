// Format an additive price modifier with explicit sign.
//   400  -> "+₱400"
//   -100 -> "−₱100"   (uses Unicode minus, visually balanced with "+")
//   0 / null / NaN / '' -> null (caller renders nothing or 'base')
export function priceDelta(n) {
  const num = Number(n);
  if (!num || Number.isNaN(num)) return null;
  const formatted = Math.abs(num).toLocaleString();
  return num > 0 ? `+₱${formatted}` : `−₱${formatted}`;
}
