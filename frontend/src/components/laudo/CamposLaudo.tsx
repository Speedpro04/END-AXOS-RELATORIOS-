import React, { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, PenLine, Plus, Trash2 } from 'lucide-react'
import { DesenhoCroqui } from './DesenhoCroqui'
import { METHOD_LABELS, type ENDMethod, type InspectionReport } from '../../types/inspection'
import type { FotoLaudo, IdentificacaoEnsaio } from '../../types/laudoEnsaio'
import { hashDaFoto, imagemUsadaEmOutroLaudo, lerAnexo, removerAnexo, salvarAnexo } from '../../services/anexos'
import { descreverQualificacao, minhasQualificacoes, qualificacaoValida, type Qualificacao } from '../../services/qualificacoes'
import { useAuth } from '../../contexts/AuthContext'

// ── Campos ──

interface CampoProps {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  placeholder?: string
  obrigatorio?: boolean
  numerico?: boolean
  tipo?: 'text' | 'date' | 'email'
  sugestoes?: string[]
  /** Classe extra no bloco do campo (ex.: dado trazido do cadastro, em cinza) */
  className?: string
}

export const Campo: React.FC<CampoProps> = ({ rotulo, valor, aoMudar, placeholder, obrigatorio, numerico, tipo = 'text', sugestoes, className }) => {
  const id = useId()
  return (
    <div className={className ? `lf-campo ${className}` : 'lf-campo'}>
      <label htmlFor={id}>{rotulo}{obrigatorio ? ' (obrigatório)' : ''}</label>
      <input
        id={id}
        type={tipo}
        inputMode={numerico ? 'decimal' : undefined}
        required={obrigatorio}
        placeholder={placeholder}
        value={valor}
        list={sugestoes ? `${id}-lista` : undefined}
        onChange={(e) => aoMudar(e.target.value)}
      />
      {sugestoes && (
        <datalist id={`${id}-lista`}>
          {sugestoes.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  )
}

interface SelecaoProps {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  opcoes: Array<{ valor: string; rotulo: string }>
  vazio?: string
}

export const Selecao: React.FC<SelecaoProps> = ({ rotulo, valor, aoMudar, opcoes, vazio }) => {
  const id = useId()
  return (
    <div className="lf-campo">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </div>
  )
}

export const AreaTexto: React.FC<{ rotulo: string; valor: string; aoMudar: (valor: string) => void; placeholder?: string; linhas?: number }> = ({ rotulo, valor, aoMudar, placeholder, linhas = 4 }) => {
  const id = useId()
  return (
    <div className="lf-campo lf-campo-largo">
      <label htmlFor={id}>{rotulo}</label>
      <textarea id={id} rows={linhas} placeholder={placeholder} value={valor} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  )
}

export const Secao: React.FC<{ titulo: string; descricao?: string; children: React.ReactNode }> = ({ titulo, descricao, children }) => (
  <section className="lf-secao">
    <h2>{titulo}</h2>
    {descricao && <p className="lf-descricao">{descricao}</p>}
    {children}
  </section>
)

// ── Linhas repetidas (cabeçotes e indicações) ──

interface LinhasProps<T extends { id: string }> {
  rotuloLinha: string
  textoAdicionar: string
  textoVazio: string
  linhas: T[]
  aoMudar: (linhas: T[]) => void
  nova: () => T
  campos: (linha: T, alterar: (parcial: Partial<T>) => void, indice: number) => React.ReactNode
}

export function Linhas<T extends { id: string }>({ rotuloLinha, textoAdicionar, textoVazio, linhas, aoMudar, nova, campos }: LinhasProps<T>) {
  return (
    <div className="lf-linhas">
      {linhas.length === 0 && <p className="lf-descricao">{textoVazio}</p>}
      {linhas.map((linha, i) => (
        <div className="lf-linha" key={linha.id}>
          <div className="lf-linha-topo">
            <strong>{rotuloLinha} {i + 1}</strong>
            <button type="button" className="lf-botao" aria-label={`Remover ${rotuloLinha.toLowerCase()} ${i + 1}`} onClick={() => aoMudar(linhas.filter((l) => l.id !== linha.id))}>
              <Trash2 size={16} strokeWidth={1.75} /> Remover
            </button>
          </div>
          <div className="lf-grade">
            {campos(linha, (parcial) => aoMudar(linhas.map((l) => (l.id === linha.id ? { ...l, ...parcial } : l))), i)}
          </div>
        </div>
      ))}
      <button type="button" className="lf-botao" onClick={() => aoMudar([...linhas, nova()])}>
        <Plus size={16} strokeWidth={1.75} /> {textoAdicionar}
      </button>
    </div>
  )
}

// ── Base comum do laudo ──

export interface BaseLaudo {
  id: string
  equipmentTag: string
  local: string
  norma: string
  criterio: string
  data: string
  inspetor: string
  snqc: string
  qualificacaoId: string | null
  veredito: 'rascunho' | 'aprovado' | 'reprovado'
  parecer: string
  observacoes: string
  linhaId: string | null
  quantidadeInspecionada: number
  quantidadeAprovada: number
  quantidadeReprovada: number
}

export function baseInicial(metodo: ENDMethod, inicial: InspectionReport | null | undefined, nomeUsuario?: string | null): BaseLaudo {
  // O status do laudo é do servidor; a conclusão do inspetor fica nos dados técnicos
  const status = (inicial?.technicalData?.conclusao as string | undefined) ?? inicial?.status
  return {
    id: inicial?.id ?? crypto.randomUUID(),
    equipmentTag: inicial?.equipmentTag && inicial.equipmentTag !== 'TAG-PENDENTE' ? inicial.equipmentTag : '',
    local: inicial?.unitArea ?? '',
    norma: inicial?.normProcedure ?? METHOD_LABELS[metodo].code,
    criterio: inicial?.acceptanceCriteria ?? '',
    data: inicial?.date ?? new Date().toISOString().slice(0, 10),
    inspetor: inicial?.inspectorName ?? nomeUsuario ?? '',
    snqc: inicial?.inspectorSNQC ?? '',
    qualificacaoId: inicial?.qualificationId ?? null,
    veredito: status === 'aprovado' || status === 'reprovado' ? status : 'rascunho',
    parecer: inicial?.summary ?? '',
    observacoes: (inicial?.technicalData?.observacoes as string) ?? '',
    linhaId: inicial?.linhaId ?? null,
    quantidadeInspecionada: inicial?.quantidadeInspecionada ?? 0,
    quantidadeAprovada: inicial?.quantidadeAprovada ?? 0,
    quantidadeReprovada: inicial?.quantidadeReprovada ?? 0,
  }
}

export function identificacaoInicial(tech: Partial<IdentificacaoEnsaio> | undefined): IdentificacaoEnsaio {
  return {
    cliente: tech?.cliente ?? '',
    obra: tech?.obra ?? '',
    desenho: tech?.desenho ?? '',
    itemEnsaiado: tech?.itemEnsaiado ?? '',
    material: tech?.material ?? '',
    procedimento: tech?.procedimento ?? '',
    revisaoProcedimento: tech?.revisaoProcedimento ?? '',
    planoInspecao: tech?.planoInspecao ?? '',
  }
}

export const CabecalhoLaudo: React.FC<{ metodo?: ENDMethod; titulo: string; aoVoltar: () => void }> = ({ metodo, titulo, aoVoltar }) => (
  <>
    <div className="lf-topo">
      <button type="button" className="lf-botao" onClick={aoVoltar}>
        <ArrowLeft size={16} strokeWidth={1.75} /> {metodo ? 'Voltar ao catálogo' : 'Voltar'}
      </button>
      {metodo && <span className="lf-etiqueta">{METHOD_LABELS[metodo].label}</span>}
    </div>
    <h1 className="lf-titulo">{titulo}</h1>
  </>
)

export const BlocoIdentificacao: React.FC<{
  base: BaseLaudo
  aoMudarBase: (parcial: Partial<BaseLaudo>) => void
  ident: IdentificacaoEnsaio
  aoMudarIdent: (parcial: Partial<IdentificacaoEnsaio>) => void
}> = ({ base, aoMudarBase, ident, aoMudarIdent }) => (
  <Secao titulo="Identificação">
    <div className="lf-grade">
      <Campo rotulo="Cliente" valor={ident.cliente} aoMudar={(v) => aoMudarIdent({ cliente: v })} />
      <Campo rotulo="Obra ou fabricante" valor={ident.obra} aoMudar={(v) => aoMudarIdent({ obra: v })} />
      <Campo rotulo="Equipamento ou tubulação" obrigatorio placeholder="Ex: V-2104" valor={base.equipmentTag} aoMudar={(v) => aoMudarBase({ equipmentTag: v })} />
      <Campo rotulo="Item ensaiado" valor={ident.itemEnsaiado} aoMudar={(v) => aoMudarIdent({ itemEnsaiado: v })} />
      <Campo rotulo="Local do ensaio" valor={base.local} aoMudar={(v) => aoMudarBase({ local: v })} />
      <Campo rotulo="Desenho de referência" valor={ident.desenho} aoMudar={(v) => aoMudarIdent({ desenho: v })} />
      <Campo rotulo="Material" valor={ident.material} aoMudar={(v) => aoMudarIdent({ material: v })} />
      <Campo rotulo="Data do ensaio" tipo="date" valor={base.data} aoMudar={(v) => aoMudarBase({ data: v })} />
      <Campo rotulo="Procedimento" valor={ident.procedimento} aoMudar={(v) => aoMudarIdent({ procedimento: v })} />
      <Campo rotulo="Revisão do procedimento" valor={ident.revisaoProcedimento} aoMudar={(v) => aoMudarIdent({ revisaoProcedimento: v })} />
      <Campo rotulo="Norma de referência" valor={base.norma} aoMudar={(v) => aoMudarBase({ norma: v })} />
      <Campo rotulo="Critério de aceitação" valor={base.criterio} aoMudar={(v) => aoMudarBase({ criterio: v })} />
      <Campo rotulo="Plano de inspeção e teste" valor={ident.planoInspecao} aoMudar={(v) => aoMudarIdent({ planoInspecao: v })} />
    </div>
  </Secao>
)

export const BlocoResponsavel: React.FC<{ base: BaseLaudo; aoMudar: (parcial: Partial<BaseLaudo>) => void; exemploSnqc: string; metodo: ENDMethod }> = ({ base, aoMudar, exemploSnqc, metodo }) => {
  const { user } = useAuth()
  const [qualificacoes, setQualificacoes] = useState<Qualificacao[] | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let ativo = true
    void minhasQualificacoes(user.id).then((lista) => { if (ativo) setQualificacoes(lista.filter((q) => q.method === metodo)) })
    return () => { ativo = false }
  }, [user?.id, metodo])

  const escolhida = qualificacoes?.find((q) => q.id === base.qualificacaoId)
  const vencida = escolhida && !qualificacaoValida(escolhida, base.data)

  return (
    <Secao titulo="Responsável técnico">
      <div className="lf-coluna">
        <Campo rotulo="Inspetor" obrigatorio valor={base.inspetor} aoMudar={(v) => aoMudar({ inspetor: v })} />
        {qualificacoes && qualificacoes.length > 0 && (
          <Selecao
            rotulo="Qualificação usada neste laudo"
            valor={base.qualificacaoId ?? ''}
            vazio="Escolha a qualificação"
            opcoes={qualificacoes.map((q) => ({
              valor: q.id,
              rotulo: `${descreverQualificacao(q)}, válida até ${q.valid_until.split('-').reverse().join('/')}${qualificacaoValida(q, base.data) ? '' : ' (vencida)'}`,
            }))}
            aoMudar={(id) => {
              const q = qualificacoes.find((x) => x.id === id)
              aoMudar({ qualificacaoId: id || null, ...(q ? { snqc: descreverQualificacao(q) } : {}) })
            }}
          />
        )}
        {vencida && <p className="lf-alerta" role="alert">Esta qualificação está vencida na data do ensaio. O laudo não poderá ser enviado para revisão com ela.</p>}
        {qualificacoes && qualificacoes.length === 0 && (
          <p className="lf-descricao">Você não tem qualificação de {METHOD_LABELS[metodo].label} cadastrada. Peça ao administrador para cadastrar em Equipe; sem ela o laudo não pode ser enviado para revisão.</p>
        )}
        <Campo rotulo="Registro SNQC" obrigatorio placeholder={exemploSnqc} valor={base.snqc} aoMudar={(v) => aoMudar({ snqc: v })} />
      </div>
    </Secao>
  )
}

export const BlocoConclusao: React.FC<{
  base: BaseLaudo
  aoMudar: (parcial: Partial<BaseLaudo>) => void
  temReprovada: boolean
  aviso?: string
  erro: string | null
  salvando: boolean
  aoCancelar: () => void
  children?: React.ReactNode
}> = ({ base, aoMudar, temReprovada, aviso = "Atenção: há indicação reprovada, mas o laudo está como aprovado.", erro, salvando, aoCancelar, children }) => (
  <>
    <Secao titulo="Conclusão">
      <div className="lf-coluna">
        <Selecao
          rotulo="Laudo"
          valor={base.veredito}
          aoMudar={(v) => aoMudar({ veredito: v as BaseLaudo['veredito'] })}
          opcoes={[
            { valor: 'rascunho', rotulo: 'Em preenchimento' },
            { valor: 'aprovado', rotulo: 'Aprovado' },
            { valor: 'reprovado', rotulo: 'Reprovado' },
          ]}
        />
        {temReprovada && base.veredito === 'aprovado' && (
          <p className="lf-alerta" role="alert">{aviso}</p>
        )}
        {children}
        <AreaTexto rotulo="Parecer técnico" valor={base.parecer} aoMudar={(v) => aoMudar({ parecer: v })} />
        <AreaTexto rotulo="Observações" valor={base.observacoes} aoMudar={(v) => aoMudar({ observacoes: v })} />
      </div>
    </Secao>
    <section className="lf-secao">
      {erro && <p className="lf-alerta" role="alert">{erro}</p>}
      <div className="lf-acoes">
        <button type="button" className="lf-botao" onClick={aoCancelar}>Cancelar</button>
        <button type="submit" className="lf-botao lf-botao-primario" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Registrar laudo'}
        </button>
      </div>
    </section>
  </>
)

// ── Fotos e telas do aparelho ──

export interface FotoRascunho {
  id: string
  anexoId?: string
  arquivo?: File
  url: string
  legenda: string
  repetida?: boolean
}

export function useFotos(salvas: FotoLaudo[] | undefined) {
  const [fotos, setFotos] = useState<FotoRascunho[]>([])
  const removidas = useRef<string[]>([])
  const urls = useRef<string[]>([])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const carregadas: FotoRascunho[] = []
      for (const f of salvas ?? []) {
        try {
          const arquivo = await lerAnexo(f.anexoId)
          const url = URL.createObjectURL(arquivo)
          urls.current.push(url)
          carregadas.push({ id: f.anexoId, anexoId: f.anexoId, url, legenda: f.legenda })
        } catch {
          // Veio de outro aparelho e ainda não foi possível baixar, ou ainda não subiu de lá
          carregadas.push({ id: f.anexoId, anexoId: f.anexoId, url: '', legenda: f.legenda })
        }
      }
      if (ativo) setFotos(carregadas)
    })()
    const criadas = urls.current
    return () => {
      ativo = false
      criadas.forEach((u) => URL.revokeObjectURL(u))
    }
    // Carrega só ao abrir o formulário
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const adicionar = async (arquivos: FileList | File[] | null, laudoId: string, legenda = '') => {
    for (const arquivo of Array.from(arquivos ?? [])) {
      const url = URL.createObjectURL(arquivo)
      urls.current.push(url)
      const id = crypto.randomUUID()
      setFotos((atual) => [...atual, { id, arquivo, url, legenda }])
      try {
        const repetida = await imagemUsadaEmOutroLaudo(await hashDaFoto(arquivo), laudoId)
        if (repetida) setFotos((atual) => atual.map((f) => (f.id === id ? { ...f, repetida: true } : f)))
      } catch {
        // A verificação é só um aviso: não impede registrar a foto
      }
    }
  }

  const remover = (id: string) => {
    setFotos((atual) => {
      const alvo = atual.find((f) => f.id === id)
      if (alvo?.anexoId) removidas.current.push(alvo.anexoId)
      return atual.filter((f) => f.id !== id)
    })
  }

  const alterarLegenda = (id: string, legenda: string) => {
    setFotos((atual) => atual.map((f) => (f.id === id ? { ...f, legenda } : f)))
  }

  /** Grava as fotos novas no aparelho e devolve a lista para guardar no laudo. */
  const persistir = async (laudoId: string): Promise<FotoLaudo[]> => {
    const resultado: FotoLaudo[] = []
    for (const f of fotos) {
      if (f.anexoId) {
        resultado.push({ anexoId: f.anexoId, legenda: f.legenda })
      } else if (f.arquivo) {
        const meta = await salvarAnexo({ laudoId, tipo: 'foto', arquivo: f.arquivo })
        if (!resultado.some((r) => r.anexoId === meta.id)) resultado.push({ anexoId: meta.id, legenda: f.legenda })
      }
    }
    for (const id of removidas.current) {
      if (!resultado.some((r) => r.anexoId === id)) await removerAnexo(id, laudoId).catch(() => undefined)
    }
    return resultado
  }

  return { fotos, adicionar, remover, alterarLegenda, persistir }
}

export const BlocoFotos: React.FC<{
  titulo?: string
  descricao: string
  laudoId: string
  controle: ReturnType<typeof useFotos>
  sugestoes: string[]
}> = ({ titulo = 'Evidências', descricao, laudoId, controle, sugestoes }) => {
  const entrada = useRef<HTMLInputElement>(null)
  const [desenhando, setDesenhando] = useState(false)
  return (
    <Secao titulo={titulo} descricao={descricao}>
      <div className="lf-fotos">
        {controle.fotos.map((f, i) => (
          <div className="lf-foto" key={f.id}>
            {f.url
              ? <img src={f.url} alt={f.legenda || `Evidência ${i + 1}`} />
              : <p className="lf-descricao">Imagem indisponível agora. Ela pode ainda não ter sido enviada pelo aparelho de origem. Confira a internet e abra o laudo de novo.</p>}
            <Campo rotulo={`Legenda da imagem ${i + 1}`} valor={f.legenda} sugestoes={sugestoes} aoMudar={(v) => controle.alterarLegenda(f.id, v)} />
            {f.repetida && <p className="lf-alerta" role="alert">Atenção: esta mesma imagem já está em outro laudo.</p>}
            <button type="button" className="lf-botao" onClick={() => controle.remover(f.id)}>
              <Trash2 size={16} strokeWidth={1.75} /> Remover imagem
            </button>
          </div>
        ))}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Escolher imagens"
        onChange={(e) => {
          void controle.adicionar(e.target.files, laudoId)
          e.target.value = ''
        }}
      />
      <div className="lf-fotos-botoes">
        <button type="button" className="lf-botao" onClick={() => entrada.current?.click()}>
          <ImagePlus size={16} strokeWidth={1.75} /> Adicionar imagem
        </button>
        <button type="button" className="lf-botao" onClick={() => setDesenhando(true)}>
          <PenLine size={16} strokeWidth={1.75} /> Desenhar croqui
        </button>
      </div>
      {desenhando && (
        <DesenhoCroqui
          aoFechar={() => setDesenhando(false)}
          aoSalvar={(arquivo) => {
            setDesenhando(false)
            void controle.adicionar([arquivo], laudoId, sugestoes.find((s) => /croqui|desenho/i.test(s)) ?? 'Croqui')
          }}
        />
      )}
    </Secao>
  )
}
