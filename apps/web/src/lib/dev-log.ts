/** Dev-only logging — stripped from production console noise. */
export function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.info(...args);
  }
}