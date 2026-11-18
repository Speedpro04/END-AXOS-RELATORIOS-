import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Eraser, Grid3x3, Trash2, Undo2, X } from 'lucide-react'

// Tela cheia para desenhar croqui e esboço com o dedo, caneta ou mouse.
// Ao salvar, o desenho vira uma imagem PNG e entra no bloco de imagens do laudo.

const CORES = [
  { nome: 'Preto', valor: '#111111' },
  { nome: 'Vermelho', valor: '#D32F2F' },
  { nome: 'Azul', valor: '#1565C0' },
]
const ESPESSURAS = [
  { nome: 'Fina', valor: 0.003 },
  { nome: 'Grossa', valor: 0.008 },
]
// Lado maior da imagem salva (mesmo limite das fotos)
const LADO_SALVO = 1600

interface Traco {
  cor: string
  espessura: number // fração da largura do desenho
  borracha: boolean
  pontos: [number, number][] // coordenadas de 0 a 1
}

function desenharFundo(ctx: CanvasRenderingContext2D, w: number, h: number, quadriculado: boolean) {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)
  if (!quadriculado) return
  const passo = w / 40
  ctx.strokeStyle = '#DCE3EC'
  ctx.lineWidth = Math.max(1, w / 1600)
  ctx.beginPath()
  for (let x = passo; x < w; x += passo) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
  for (let y = passo; y < h; y += passo) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
  ctx.stroke()
}

function desenharTraco(ctx: CanvasRenderingContext2D, t: Traco, w: number, h: number, desde = 0) {
  ctx.globalCompositeOperation = t.borracha ? 'destination-out' : 'source-over'
  ctx.strokeStyle = t.cor
  ctx.fillStyle = t.cor
  ctx.lineWidth = t.espessura * w * (t.borracha ? 3 : 1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const p = t.pontos
  if (p.length === 1) {
    ctx.beginPath()
    ctx.arc(p[0][0] * w, p[0][1] * h, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    const inicio = Math.max(0, desde - 1)
    ctx.moveTo(p[inicio][0] * w, p[inicio][1] * h)
    for (let i = inicio + 1; i < p.length; i++) ctx.lineTo(p[i][0] * w, p[i][1] * h)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

/** Monta o desenho completo (fundo + traços) num canvas do tamanho pedido. */
function renderizar(destino: HTMLCanvasElement, tracos: Traco[], quadriculado: boolean) {
  const w = destino.width
  const h = destino.height
  // Os traços ficam numa camada separada para a borracha não apagar o quadriculado
  const camada = document.createElement('canvas')
  camada.width = w
  camada.height = h
  const cc = camada.getContext('2d')
  const ctx = destino.getContext('2d')
  if (!cc || !ctx) return
  tracos.forEach((t) => desenharTraco(cc, t, w, h))
  desenharFundo(ctx, w, h, quadriculado)
  ctx.drawImage(camada, 0, 0)
}

export const DesenhoCroqui: React.FC<{
  aoSalvar: (arquivo: File) => void
  aoFechar: () => void
}> = ({ aoSalvar, aoFechar }) => {
  const area = useRef<HTMLDivElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  const camada = useRef<HTMLCanvasElement | null>(null)
  const atual = useRef<Traco | null>(null)
  // Proporção fixada ao abrir, para o desenho não distorcer se a tela girar
  const proporcao = useRef(0)
  const [tracos, setTracos] = useState<Traco[]>([])
  const [cor, setCor] = useState(CORES[0].valor)
  const [espessura, setEspessura] = useState(ESPESSURAS[0].valor)
  const [borracha, setBorracha] = useState(false)
  const [quadriculado, setQuadriculado] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // Junta fundo + camada de traços na tela visível
  const compor = useCallback(() => {
    const c = tela.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !camada.current) return
    desenharFundo(ctx, c.width, c.height, quadriculado)
    ctx.drawImage(camada.current, 0, 0)
  }, [quadriculado])

  // Redesenha todos os traços na camada (ao desfazer, limpar ou mudar o tamanho)
  const redesenhar = useCallback((lista: Traco[]) => {
    const c = tela.current
    if (!c) return
    if (!camada.current) camada.current = document.createElement('canvas')
    camada.current.width = c.width
    camada.current.height = c.height
    const cc = camada.current.getContext('2d')
    if (!cc) return
    lista.forEach((t) => desenharTraco(cc, t, c.width, c.height))
    compor()
  }, [compor])

  // Ajusta o tamanho da tela ao espaço disponível, mantendo a proporção
  const ajustar = useCallback(() => {
    const a = area.current
    const c = tela.current
    if (!a || !c) return
    const { width: aw, height: ah } = a.getBoundingClientRect()
    if (!proporcao.current) proporcao.current = aw / ah
    const r = proporcao.current
    const w = Math.min(aw, ah * r)
    const h = w / r
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
  }, [])

  const tracosRef = useRef(tracos)
  tracosRef.current = tracos

  useEffect(() => {
    ajustar()
    redesenhar(tracosRef.current)
    const aoRedimensionar = () => { ajustar(); redesenhar(tracosRef.current) }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [ajustar, redesenhar])

  useEffect(() => { compor() }, [compor])

  const fechar = useCallback(() => {
    if (tracosRef.current.length && !window.confirm('Descartar este desenho?')) return
    aoFechar()
  }, [aoFechar])

  // Trava a rolagem da página e fecha com Esc
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    window.addEventListener('keydown', tecla)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', tecla)
    }
  }, [fechar])

  const posicao = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = tela.current!.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ]
  }

  const iniciar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    atual.current = { cor, espessura, borracha, pontos: [posicao(e)] }
    const c = tela.current
    const cc = camada.current?.getContext('2d')
    if (c && cc) { desenharTraco(cc, atual.current, c.width, c.height); compor() }
  }

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = atual.current
    const c = tela.current
    const cc = camada.current?.getContext('2d')
    if (!t || !c || !cc) return
    const desde = t.pontos.length
    const eventos = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of eventos) t.pontos.push(posicao(ev))
    desenharTraco(cc, t, c.width, c.height, desde)
    compor()
  }

  const terminar = () => {
    const t = atual.current
    if (!t) return
    atual.current = null
    setTracos((lista) => [...lista, t])
  }

  const desfazer = () => {
    const nova = tracos.slice(0, -1)
    setTracos(nova)
    redesenhar(nova)
  }

  const limpar = () => {
    if (!tracos.length || !window.confirm('Apagar todo o desenho?')) return
    setTracos([])
    redesenhar([])
  }

  const salvar = () => {
    const r = proporcao.current || 1.6
    const saida = document.createElement('canvas')
    saida.width = r >= 1 ? LADO_SALVO : Math.round(LADO_SALVO * r)
    saida.height = r >= 1 ? Math.round(LADO_SALVO / r) : LADO_SALVO
    renderizar(saida, tracos, quadriculado)
    setSalvando(true)
    saida.toBlob((blob) => {
      setSalvando(false)
      if (!blob) { window.alert('Não foi possível salvar o desenho. Tente de novo.'); return }
      const data = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
      aoSalvar(new File([blob], `croqui-${data}.png`, { type: 'image/png' }))
    }, 'image/png')
  }

  const botao = (ativo: boolean) => `lf-botao dc-ferramenta${ativo ? ' dc-ativa' : ''}`

  return createPortal(
    <div className="dc-fundo" role="dialog" aria-modal="true" aria-label="Desenhar croqui">
      <div className="dc-barra" role="toolbar" aria-label="Ferramentas de desenho">
        <div className="dc-grupo">
          {CORES.map((c) => (
            <button
              key={c.valor}
              type="button"
              className={botao(!borracha && cor === c.valor)}
              aria-pressed={!borracha && cor === c.valor}
              onClick={() => { setCor(c.valor); setBorracha(false) }}
            >
              <span className="dc-cor" style={{ background: c.valor }} aria-hidden="true" /> {c.nome}
            </button>
          ))}
          <button type="button" className={botao(borracha)} aria-pressed={borracha} onClick={() => setBorracha(true)}>
            <Eraser size={16} strokeWidth={1.75} /> Borracha
          </button>
        </div>
        <div className="dc-grupo">
          {ESPESSURAS.map((e) => (
            <button key={e.valor} type="button" className={botao(espessura === e.valor)} aria-pressed={espessura === e.valor} onClick={() => setEspessura(e.valor)}>
              {e.nome}
            </button>
          ))}
          <button type="button" className={botao(quadriculado)} aria-pressed={quadriculado} onClick={() => setQuadriculado((q) => !q)}>
            <Grid3x3 size={16} strokeWidth={1.75} /> Quadriculado
          </button>
        </div>
        <div className="dc-grupo">
          <button type="button" className="lf-botao dc-ferramenta" onClick={desfazer} disabled={!tracos.length}>
            <Undo2 size={16} strokeWidth={1.75} /> Desfazer
          </button>
          <button type="button" className="lf-botao dc-ferramenta" onClick={limpar} disabled={!tracos.length}>
            <Trash2 size={16} strokeWidth={1.75} /> Limpar
          </button>
        </div>
      </div>

      <div className="dc-area" ref={area}>
        <canvas
          ref={tela}
          className="dc-tela"
          aria-label="Área de desenho do croqui"
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
      </div>

      <div className="dc-rodape">
        <button type="button" className="lf-botao" onClick={fechar}>
          <X size={16} strokeWidth={1.75} /> Cancelar
        </button>
        <button type="button" className="lf-botao lf-botao-primario" onClick={salvar} disabled={!tracos.length || salvando}>
          <Check size={16} strokeWidth={2} /> {salvando ? 'Salvando...' : 'Salvar croqui'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
