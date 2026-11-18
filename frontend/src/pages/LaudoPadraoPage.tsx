import React, { useState } from 'react'
import { METHOD_LABELS, type ENDMethod, type InspectionReport } from '../types/inspection'
import {
  CAMPOS_POR_METODO,
  TIPOS_INDICACAO,
  colunasIndicacao,
  type AparelhoEnsaio,
  type DadosPadrao,
  type IdentificacaoEnsaio,
  type IndicacaoPadrao,
} from '../types/laudoEnsaio'
import { useAuth } from '../contexts/AuthContext'
import { ObraEscopoVinculo } from '../components/laudo/ObraEscopoVinculo'
import {
  BlocoConclusao,
  BlocoFotos,
  BlocoIdentificacao,
  BlocoResponsavel,
  CabecalhoLaudo,
  Campo,
  Linhas,
  Secao,
  Selecao,
  baseInicial,
  identificacaoInicial,
  useFotos,
} from '../components/laudo/CamposLaudo'

// Formulário padrão dos métodos que ainda não têm formulário detalhado (todos menos UT e PAUT).
// Mesma base do UT e PAUT: identificação, aparelho, resultados, fotos e croqui, responsável, obra e conclusão.

interface LaudoPadraoProps {
  metodo: ENDMethod
  onBack: () => void
  onSave: (report: Partial<InspectionReport>) => Promise<void>
  initialReport?: InspectionReport | null
  siteId?: string | null
}

const novaIndicacao = (): IndicacaoPadrao => ({
  id: crypto.randomUUID(), identificacao: '', localizacao: '', tipo: '', dimensoes: '', resultado: '',
})

type Especifico = Omit<DadosPadrao, 'esquema' | 'fotos' | keyof IdentificacaoEnsaio | keyof AparelhoEnsaio>

export const LaudoPadraoPage: React.FC<LaudoPadraoProps> = ({ metodo, onBack, onSave, initialReport, siteId }) => {
  const { profile } = useAuth()
  const salvo = initialReport?.technicalData as (Partial<DadosPadrao> & Record<string, unknown>) | undefined
  const camposMetodo = CAMPOS_POR_METODO[metodo] ?? []
  const [base, setBase] = useState(() => baseInicial(metodo, initialReport, profile?.full_name))
  const [ident, setIdent] = useState(() => identificacaoInicial(salvo))
  const [aparelho, setAparelho] = useState<AparelhoEnsaio>({
    aparelhoFabricante: salvo?.aparelhoFabricante ?? '',
    aparelhoModelo: salvo?.aparelhoModelo ?? '',
    aparelhoSerie: salvo?.aparelhoSerie ?? '',
  })
  const [dados, setDados] = useState<Especifico>({
    // Laudos antigos de PT guardavam a temperatura em surfaceTemp
    temperatura: salvo?.temperatura ?? (typeof salvo?.surfaceTemp === 'string' ? salvo.surfaceTemp : ''),
    condicaoSuperficie: salvo?.condicaoSuperficie ?? '',
    tecnica: salvo?.tecnica ?? '',
    indicacoes: salvo?.indicacoes ?? [],
    recomendacao: salvo?.recomendacao ?? '',
    sit: salvo?.sit ?? '',
    rnc: salvo?.rnc ?? '',
  })
  const [extras, setExtras] = useState<Record<string, string>>(() =>
    Object.fromEntries(camposMetodo.map((c) => [c.chave, typeof salvo?.[c.chave] === 'string' ? (salvo[c.chave] as string) : ''])),
  )
  const fotos = useFotos(salvo?.fotos)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const rotulo = METHOD_LABELS[metodo]
  const mudarBase = (parcial: Partial<typeof base>) => setBase((b) => ({ ...b, ...parcial }))
  const mudar = (parcial: Partial<Especifico>) => setDados((d) => ({ ...d, ...parcial }))
  const temReprovada = dados.indicacoes.some((i) => i.resultado === 'R')

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const fotosSalvas = await fotos.persistir(base.id)
      // Os formulários antigos gravavam "metodo: Visual" em todos os métodos; não levar adiante
      const { metodo: _legado, ...anterior } = salvo ?? {}
      const tecnico: DadosPadrao & Record<string, unknown> = {
        ...anterior,
        esquema: 'padrao-v1',
        ...ident,
        ...aparelho,
        ...dados,
        ...extras,
        observacoes: base.observacoes,
        conclusao: base.veredito,
        fotos: fotosSalvas,
      }
      // Laudo antigo sem lista de indicações: mantém a contagem que já tinha
      const legado = salvo?.esquema !== 'padrao-v1'
      await onSave({
        id: base.id,
        method: metodo,
        title: `${rotulo.full} em ${base.equipmentTag}`,
        equipmentTag: base.equipmentTag.toUpperCase(),
        unitArea: base.local,
        inspectorName: base.inspetor,
        inspectorSNQC: base.snqc,
        qualificationId: base.qualificacaoId,
        normProcedure: base.norma,
        acceptanceCriteria: base.criterio,
        status: base.veredito,
        findingsCount: dados.indicacoes.length || (legado ? initialReport?.findingsCount ?? 0 : 0),
        summary: base.parecer,
        date: base.data,
        technicalData: tecnico,
        linhaId: base.linhaId,
        quantidadeInspecionada: base.quantidadeInspecionada,
        quantidadeAprovada: base.quantidadeAprovada,
        quantidadeReprovada: base.quantidadeReprovada,
      })
      onBack()
    } catch {
      setErro('Não foi possível registrar o laudo. Confira o espaço do aparelho e tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="lf-pagina">
      <CabecalhoLaudo metodo={metodo} titulo={`${initialReport ? 'Laudo' : 'Novo laudo'}: ${rotulo.full}`} aoVoltar={onBack} />
      <form onSubmit={salvar} className="laudo-grid">
        <div className="lf-coluna-secoes">
          <BlocoIdentificacao base={base} aoMudarBase={mudarBase} ident={ident} aoMudarIdent={(p) => setIdent((i) => ({ ...i, ...p }))} />

          <Secao titulo="Condições do ensaio">
            <div className="lf-grade">
              <Campo rotulo="Temperatura da superfície (°C)" numerico valor={dados.temperatura} aoMudar={(v) => mudar({ temperatura: v })} />
              <Campo rotulo="Condição da superfície" valor={dados.condicaoSuperficie} sugestoes={['Escovada', 'Esmerilhada', 'Pintada', 'Como soldada']} aoMudar={(v) => mudar({ condicaoSuperficie: v })} />
              <Campo rotulo="Técnica" valor={dados.tecnica} aoMudar={(v) => mudar({ tecnica: v })} />
              {camposMetodo.map((c) =>
                c.opcoes ? (
                  <Selecao key={c.chave} rotulo={c.rotulo} valor={extras[c.chave]} vazio="Não informado" opcoes={c.opcoes} aoMudar={(v) => setExtras((x) => ({ ...x, [c.chave]: v }))} />
                ) : (
                  <Campo key={c.chave} rotulo={c.rotulo} placeholder={c.placeholder} numerico={c.numerico} valor={extras[c.chave]} aoMudar={(v) => setExtras((x) => ({ ...x, [c.chave]: v }))} />
                ),
              )}
            </div>
          </Secao>

          <Secao titulo="Aparelho">
            <div className="lf-grade">
              <Campo rotulo="Fabricante" valor={aparelho.aparelhoFabricante} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoFabricante: v }))} />
              <Campo rotulo="Modelo" valor={aparelho.aparelhoModelo} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoModelo: v }))} />
              <Campo rotulo="Número de série" valor={aparelho.aparelhoSerie} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoSerie: v }))} />
            </div>
          </Secao>

          <Secao titulo="Registro dos resultados" descricao="Registre uma indicação por vez.">
            <Linhas
              rotuloLinha="Indicação"
              textoAdicionar="Adicionar indicação"
              textoVazio="Nenhuma indicação registrada."
              linhas={dados.indicacoes}
              aoMudar={(indicacoes) => mudar({ indicacoes })}
              nova={novaIndicacao}
              campos={(i, alterar) => (
                <>
                  <Campo rotulo="Peça ou junta" valor={i.identificacao} aoMudar={(v) => alterar({ identificacao: v })} />
                  {colunasIndicacao(metodo).map((c) => (
                    <Campo key={c.chave} rotulo={c.rotulo} placeholder={c.placeholder} numerico={c.numerico} valor={i[c.chave] ?? ''} aoMudar={(v) => alterar({ [c.chave]: v })} />
                  ))}
                  <Campo rotulo="Tipo de indicação" valor={i.tipo} sugestoes={TIPOS_INDICACAO[metodo]} aoMudar={(v) => alterar({ tipo: v })} />
                  <Selecao rotulo="Resultado" valor={i.resultado} vazio="Não informado" opcoes={[{ valor: 'A', rotulo: 'Aprovada' }, { valor: 'R', rotulo: 'Reprovada' }]} aoMudar={(v) => alterar({ resultado: v as IndicacaoPadrao['resultado'] })} />
                </>
              )}
            />
          </Secao>

          <BlocoFotos
            descricao="Fotos da peça, croqui ou esboço e tela do aparelho, cada um com legenda."
            laudoId={base.id}
            controle={fotos}
            sugestoes={['Croqui', 'Esboço', 'Foto da peça', 'Foto da indicação', 'Tela do aparelho']}
          />
        </div>

        <div className="lf-coluna-secoes">
          <BlocoResponsavel base={base} aoMudar={mudarBase} metodo={metodo} exemploSnqc={`Ex: SNQC 00000 ${rotulo.label}-N2`} />
          {siteId && (
            <Secao titulo="Medição da obra">
              <ObraEscopoVinculo
                linhaId={base.linhaId}
                quantidadeInspecionada={base.quantidadeInspecionada}
                quantidadeAprovada={base.quantidadeAprovada}
                quantidadeReprovada={base.quantidadeReprovada}
                onChange={mudarBase}
                siteId={siteId}
              />
            </Secao>
          )}
          <BlocoConclusao base={base} aoMudar={mudarBase} temReprovada={temReprovada} erro={erro} salvando={salvando} aoCancelar={onBack}>
            <Campo rotulo="Recomendação de ensaio complementar" valor={dados.recomendacao} aoMudar={(v) => mudar({ recomendacao: v })} />
            <Campo rotulo="SIT nº" valor={dados.sit} aoMudar={(v) => mudar({ sit: v })} />
            <Campo rotulo="RNC nº" valor={dados.rnc} aoMudar={(v) => mudar({ rnc: v })} />
          </BlocoConclusao>
        </div>
      </form>
    </div>
  )
}
