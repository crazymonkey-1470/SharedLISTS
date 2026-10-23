export function errorMessage(err: unknown): string {
  if (!err) return 'Something went wrong'
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    if (/failed to fetch|networkerror|load failed/i.test(err.message)) return "Can't reach the server. Check your connection."
    return err.message
  }
  return 'Something went wrong'
}
