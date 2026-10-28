export function buildReportCode(prefix: string, method: string, year: number, seq: number): string {
  return `${prefix}-${method}-${year}-${String(seq).padStart(3, '0')}`
}
