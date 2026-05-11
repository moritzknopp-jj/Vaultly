/** Parse [[wikilinks]] from a note and build a bidirectional mention map. */
export interface MentionMap {
  /** note path → list of note paths it links to (outgoing) */
  outgoing: Map<string, string[]>
  /** note path → list of note paths that link to it (incoming backlinks) */
  incoming: Map<string, string[]>
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? path
}

export function buildMentionMap(files: { path: string; content: string }[]): MentionMap {
  const nameToPath = new Map<string, string>()
  for (const f of files) {
    nameToPath.set(basename(f.path).toLowerCase(), f.path)
  }

  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  for (const f of files) {
    outgoing.set(f.path, [])
    incoming.set(f.path, [])
  }

  for (const f of files) {
    const refs = new Set<string>()
    let m: RegExpExecArray | null
    WIKILINK_RE.lastIndex = 0
    while ((m = WIKILINK_RE.exec(f.content)) !== null) {
      const target = nameToPath.get(m[1].trim().toLowerCase())
      if (target && target !== f.path) refs.add(target)
    }
    outgoing.set(f.path, [...refs])
    for (const target of refs) {
      incoming.get(target)?.push(f.path)
    }
  }

  return { outgoing, incoming }
}

export function getBacklinks(mentionMap: MentionMap, path: string): string[] {
  return mentionMap.incoming.get(path) ?? []
}

export function getOutlinks(mentionMap: MentionMap, path: string): string[] {
  return mentionMap.outgoing.get(path) ?? []
}
