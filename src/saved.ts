const KEY = 'deepcut.saved'

export function loadSaved(storage: Pick<Storage, 'getItem'> = localStorage): string[] {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function toggleSaved(saved: string[], name: string): string[] {
  return saved.includes(name) ? saved.filter((n) => n !== name) : [...saved, name]
}

export function persistSaved(saved: string[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(saved))
}
