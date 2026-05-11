import { useMemo, useRef, useEffect, useState } from 'react'
import { getVectorStore } from '../../lib/vectorSearch'
import styles from './GraphView.module.css'

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? p
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb))
}

interface Node { id: string; label: string; x: number; y: number; r: number }
interface Edge { source: string; target: string; weight: number }

export default function GraphView() {
  const store = getVectorStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null)
  const [threshold, setThreshold] = useState(0.82)

  // Aggregate chunks by source note → average embedding
  const noteEmbeddings = useMemo(() => {
    const map = new Map<string, { sum: number[]; count: number }>()
    for (const entry of store) {
      if (!map.has(entry.source)) map.set(entry.source, { sum: new Array(entry.embedding.length).fill(0), count: 0 })
      const rec = map.get(entry.source)!
      for (let i = 0; i < entry.embedding.length; i++) rec.sum[i] += entry.embedding[i]
      rec.count++
    }
    const result: { path: string; embedding: number[] }[] = []
    for (const [path, { sum, count }] of map) {
      result.push({ path, embedding: sum.map(v => v / count) })
    }
    return result
  }, [store.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build edges above threshold (cap at top 200 for performance)
  const { nodes, edges } = useMemo(() => {
    const n = noteEmbeddings.length
    const edgeList: Edge[] = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const w = cosineSimilarity(noteEmbeddings[i].embedding, noteEmbeddings[j].embedding)
        if (w >= threshold) edgeList.push({ source: noteEmbeddings[i].path, target: noteEmbeddings[j].path, weight: w })
      }
    }
    edgeList.sort((a, b) => b.weight - a.weight)
    const topEdges = edgeList.slice(0, 200)
    const connectedPaths = new Set(topEdges.flatMap(e => [e.source, e.target]))
    const nodeList = noteEmbeddings
      .filter(e => connectedPaths.has(e.path))
      .map((e, i, arr) => {
        const angle = (2 * Math.PI * i) / arr.length
        const radius = Math.min(300, 60 + arr.length * 8)
        return {
          id: e.path,
          label: basename(e.path),
          x: 500 + radius * Math.cos(angle),
          y: 380 + radius * Math.sin(angle),
          r: 5,
        } as Node
      })
    return { nodes: nodeList, edges: topEdges }
  }, [noteEmbeddings, threshold])

  // Simple force simulation (repulsion + edge attraction, 80 ticks)
  const [simNodes, setSimNodes] = useState<Node[]>([])
  useEffect(() => {
    if (nodes.length === 0) { setSimNodes([]); return }
    const ns = nodes.map(n => ({ ...n }))
    const posMap = new Map(ns.map(n => [n.id, n]))

    for (let tick = 0; tick < 80; tick++) {
      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x, dy = ns[i].y - ns[j].y
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          const force = 600 / (dist * dist)
          ns[i].x += dx / dist * force; ns[i].y += dy / dist * force
          ns[j].x -= dx / dist * force; ns[j].y -= dy / dist * force
        }
      }
      // Attraction along edges
      for (const e of edges) {
        const a = posMap.get(e.source), b = posMap.get(e.target)
        if (!a || !b) continue
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const pull = (dist - 80) * 0.05 * e.weight
        a.x += dx / dist * pull; a.y += dy / dist * pull
        b.x -= dx / dist * pull; b.y -= dy / dist * pull
      }
      // Center gravity
      const cx = ns.reduce((s, n) => s + n.x, 0) / ns.length
      const cy = ns.reduce((s, n) => s + n.y, 0) / ns.length
      for (const n of ns) { n.x += (500 - cx) * 0.01; n.y += (380 - cy) * 0.01 }
    }
    setSimNodes([...ns])
  }, [nodes.length, edges.length, threshold]) // eslint-disable-line react-hooks/exhaustive-deps

  const posMap = useMemo(() => new Map(simNodes.map(n => [n.id, n])), [simNodes])

  if (store.length === 0) {
    return <div className={styles.empty}>Index a vault first to see the similarity graph.</div>
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Semantic Graph — {simNodes.length} notes · {edges.length} connections</span>
        <div className={styles.controls}>
          <span>Similarity threshold:</span>
          <input
            type="range" min={0.7} max={0.98} step={0.01}
            value={threshold} onChange={e => setThreshold(Number(e.target.value))}
            className={styles.slider}
          />
          <span>{(threshold * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className={styles.canvas}>
        <svg ref={svgRef} className={styles.svg} viewBox="0 0 1000 760">
          {/* Edges */}
          {edges.map((e, i) => {
            const a = posMap.get(e.source), b = posMap.get(e.target)
            if (!a || !b) return null
            return (
              <line key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={`rgba(212,175,55,${(e.weight - threshold) / (1 - threshold) * 0.6})`}
                strokeWidth={e.weight > 0.92 ? 1.5 : 0.8}
              />
            )
          })}
          {/* Nodes */}
          {simNodes.map(n => (
            <g key={n.id}
              onMouseEnter={ev => {
                const rect = svgRef.current?.getBoundingClientRect()
                if (rect) setTooltip({ x: ev.clientX - rect.left + 10, y: ev.clientY - rect.top - 10, label: n.label })
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'default' }}
            >
              <circle cx={n.x} cy={n.y} r={n.r + 2} fill="rgba(212,175,55,0.15)" />
              <circle cx={n.x} cy={n.y} r={n.r} fill="#d4af37" />
            </g>
          ))}
        </svg>
        {tooltip && (
          <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
            {tooltip.label}
          </div>
        )}
      </div>
    </div>
  )
}
