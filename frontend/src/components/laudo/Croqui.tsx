import React, { useCallback, useEffect, useRef, useState } from 'react'

export interface CroquiMark {
  id: string
  x: number // coordenada normalizada 0-1
  y: number // coordenada normalizada 0-1
  type: 'indicacao' | 'traco'
}

interface CroquiProps {
  marks: CroquiMark[]
  onChange: (marks: CroquiMark[]) => void
}

export const Croqui: React.FC<CroquiProps> = ({ marks, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<'indicacao' | 'lapis'>('indicacao')
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null)

  const W = 600
  const H = 300

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = W * 2
    canvas.height = H * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(2, 2)
    draw(ctx)
  }, [marks])

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const W = 600
    const H = 300
    const style = getComputedStyle(document.documentElement)
    const inpBg = style.getPropertyValue('--bg-surface-alt') || '#f5f6f9'
    const mutColor = style.getPropertyValue('--text-muted') || '#566074'
    const inkColor = style.getPropertyValue('--text-primary') || '#14171f'
    const accColor = style.getPropertyValue('--accent') || '#2b3140'
    const accText = style.getPropertyValue('--text-primary') || '#fff'

    ctx.fillStyle = inpBg
    ctx.fillRect(0, 0, W, H)

    // Desenho da junta em V
    ctx.strokeStyle = mutColor
    ctx.fillStyle = mutColor
    ctx.lineWidth = 1.5
    ctx.font = '12px system-ui'

    ctx.beginPath()
    ctx.moveTo(40, 90)
    ctx.lineTo(230, 90)
    ctx.lineTo(260, 190)
    ctx.lineTo(40, 190)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(560, 90)
    ctx.lineTo(370, 90)
    ctx.lineTo(340, 190)
    ctx.lineTo(560, 190)
    ctx.stroke()

    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(230, 90)
    ctx.lineTo(370, 90)
    ctx.moveTo(260, 190)
    ctx.lineTo(340, 190)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = mutColor
    ctx.fillText('Superfície A', 50, 78)
    ctx.fillText('Superfície B', 480, 78)
    ctx.fillText('Junta soldada (chanfro em V)', 200, 222)

    // Traços do lápis
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = inkColor

    marks.forEach((m) => {
      if (m.type === 'traco') {
        // reconstruir traços seria necessário armazenar pontos; por simplicidade, desenhar apenas pontos de indicação
      }
    })

    // Marcadores de indicação (número sequencial)
    marks
      .filter((m) => m.type === 'indicacao')
      .forEach((m, i) => {
        const x = m.x * W
        const y = m.y * H
        ctx.fillStyle = accColor
        ctx.beginPath()
        ctx.arc(x, y, 12, 0, 7)
        ctx.fill()
        ctx.fillStyle = accText
        ctx.textAlign = 'center'
        ctx.font = 'bold 12px system-ui'
        ctx.fillText(String(i + 1), x, y + 4)
        ctx.textAlign = 'left'
      })
  }, [])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return [0, 0]
    const rect = canvas.getBoundingClientRect()
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const [x, y] = getPos(e)
      if (tool === 'indicacao') {
        const newMark: CroquiMark = {
          id: crypto.randomUUID(),
          x,
          y,
          type: 'indicacao',
        }
        onChange([...marks, newMark])
      } else {
        canvas.setPointerCapture(e.pointerId)
        setCurrentStroke([{ x, y }])
      }
    },
    [tool, marks, onChange]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!currentStroke) return
      const canvas = canvasRef.current
      if (!canvas) return
      const [x, y] = getPos(e)
      setCurrentStroke([...currentStroke, { x, y }])
    },
    [currentStroke]
  )

  const handlePointerUp = useCallback(() => {
    setCurrentStroke(null)
  }, [])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-surface)' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setTool('indicacao')}
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: `2px solid ${tool === 'indicacao' ? 'var(--accent)' : 'var(--border)'}`,
            background: tool === 'indicacao' ? 'var(--accent)' : 'var(--bg-surface)',
            color: tool === 'indicacao' ? '#fff' : 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Marcar Indicação
        </button>
        <button
          type="button"
          onClick={() => setTool('lapis')}
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: `2px solid ${tool === 'lapis' ? 'var(--accent)' : 'var(--border)'}`,
            background: tool === 'lapis' ? 'var(--accent)' : 'var(--bg-surface)',
            color: tool === 'lapis' ? '#fff' : 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Lápis
        </button>
        <button
          type="button"
          onClick={() => onChange(marks.filter((m) => m.type !== 'traco'))}
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Limpar Traços
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid var(--border)', touchAction: 'none', cursor: 'crosshair' }}
        aria-label="Croqui da junta com as indicações marcadas"
      />
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 12px', margin: 0 }}>
        Toque no croqui para marcar uma indicação. Ela entra na tabela com o mesmo número.
      </p>
    </div>
  )
}
