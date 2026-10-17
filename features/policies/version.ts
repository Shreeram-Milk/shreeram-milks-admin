/** "1.0" -> "1.1", "2" -> "3"; anything unexpected restarts at "1.0". Only a suggestion: the backend checks the version is unused. */
export function nextVersion(versions: string[]): string {
  const parsed = versions.map(version => /^(\d+)(?:\.(\d+))?$/.exec(version.trim())).filter((match): match is RegExpExecArray => match !== null).map(match => [Number(match[1]), Number(match[2] ?? 0)] as const)
  const latest = parsed.sort((a, b) => b[0] - a[0] || b[1] - a[1])[0]
  return latest ? `${latest[0]}.${latest[1] + 1}` : '1.0'
}
