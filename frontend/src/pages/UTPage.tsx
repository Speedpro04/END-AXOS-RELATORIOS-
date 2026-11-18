import React, { useState } from 'react'
import { METHOD_LABELS, type ENDMethod, type InspectionReport } from '../types/inspection'
import {
  TIPOS_DEFEITO,
  type AparelhoEnsaio,
  type Cabecote,
  type DadosUt,
  type IdentificacaoEnsaio,
  type IndicacaoUt,
} from '../types/laudoEnsaio'
import { useAuth } from '../contexts/AuthContext'
import { ObraEscopoVinculo } from '../components/laudo/ObraEscopoVinculo'
import { FluxoLaudo } from '../components/laudo/FluxoLaudo'
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

const METHOD: ENDMethod = 'UT'

interface LaudoPageProps {
  onBack: () => void
  onSave: (report: Partial<InspectionReport>) => Promise<void>
  initialReport?: InspectionReport | null
  siteId?: string | null
}

const novoCabecote = (): Cabecote => ({
  id: crypto.randomUUID(), fabricante: '', modelo: '', serie: '', dimensoes: '', angulo: '', frequencia: '',
  espessuraPeca: '', espessuraBloco: '', ganhoReferencia: '', ganhoAuxiliar: '', ganhoCorrigido: '', ganhoVarredura: '', superficie: '',
})

const novaIndicacao = (): IndicacaoUt => ({
  id: crypto.randomUUID(), identificacao: '', tipoProvavel: '', comprimento: '', profundidade: '', percursoSonico: '',
  distanciaBorda: '', localizacao: '', superficie: '', nivelIndicacao: '', nivelReferencia: '', fatorAtenuacao: '',
  nivelDescontinuidade: '', cabecote: '', soldadorRaiz: '', soldadorEnchimento: '', tipoDefeito: '', resultado: '',
})

type Especifico = Omit<DadosUt, 'esquema' | 'fotos' | keyof IdentificacaoEnsaio | keyof AparelhoEnsaio>

export const UTPage: React.FC<LaudoPageProps> = ({ onBack, onSave, initialReport, siteId }) => {
  const { profile } = useAuth()
  const salvo = initialReport?.technicalData as Partial<DadosUt> | undefined
  const [base, setBase] = useState(() => baseInicial(METHOD, initialReport, profile?.full_name))
  const [ident, setIdent] = useState(() => identificacaoInicial(salvo))
  const [aparelho, setAparelho] = useState<AparelhoEnsaio>({
    aparelhoFabricante: salvo?.aparelhoFabricante ?? '',
    aparelhoModelo: salvo?.aparelhoModelo ?? '',
    aparelhoSerie: salvo?.aparelhoSerie ?? '',
  })
  const [dados, setDados] = useState<Especifico>({
    temperatura: salvo?.temperatura ?? '',
    condicaoSuperficie: salvo?.condicaoSuperficie ?? '',
    acoplante: salvo?.acoplante ?? '',
    tecnica: salvo?.tecnica ?? '',
    blocoPadrao: salvo?.blocoPadrao ?? '',
    blocoReferencia: salvo?.blocoReferencia ?? '',
    tipoJunta: salvo?.tipoJunta ?? '',
    tratamentoTermico: salvo?.tratamentoTermico ?? '',
    cabecotes: salvo?.cabecotes ?? [],
    indicacoes: salvo?.indicacoes ?? [],
    recomendacao: salvo?.recomendacao ?? '',
    sit: salvo?.sit ?? '',
    rnc: salvo?.rnc ?? '',
  })
  const fotos = useFotos(salvo?.fotos)
  const [salvando, setSalvando] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mudarBase = (parcial: Partial<typeof base>) => setBase((b) => ({ ...b, ...parcial }))
  const mudar = (parcial: Partial<Especifico>) => setDados((d) => ({ ...d, ...parcial }))
  const temReprovada = dados.indicacoes.some((i) => i.resultado === 'R')

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const fotosSalvas = await fotos.persistir(base.id)
      const tecnico: DadosUt & { observacoes: string; conclusao: string } = {
        ...salvo,
        esquema: 'ut-solda-v1',
        ...ident,
        ...aparelho,
        ...dados,
        observacoes: base.observacoes,
        conclusao: base.veredito,
        fotos: fotosSalvas,
      }
      await onSave({
        id: base.id,
        method: METHOD,
        title: `${METHOD_LABELS[METHOD].full} em ${base.equipmentTag}`,
        equipmentTag: base.equipmentTag.toUpperCase(),
        unitArea: base.local,
        inspectorName: base.inspetor,
        inspectorSNQC: base.snqc,
        qualificationId: base.qualificacaoId,
        normProcedure: base.norma,
        acceptanceCriteria: base.criterio,
        status: base.veredito,
        findingsCount: dados.indicacoes.length,
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
      <CabecalhoLaudo metodo={METHOD} titulo={`${initialReport ? 'Laudo' : 'Novo laudo'}: ${METHOD_LABELS[METHOD].full}`} aoVoltar={onBack} />
      <FluxoLaudo laudoId={base.id} onBloqueio={setBloqueado} />
      <form onSubmit={salvar}>
        <fieldset className="laudo-grid lf-fieldset" disabled={bloqueado}>
        <div className="lf-coluna-secoes">
          <BlocoIdentificacao base={base} aoMudarBase={mudarBase} ident={ident} aoMudarIdent={(p) => setIdent((i) => ({ ...i, ...p }))} />

          <Secao titulo="Condições do ensaio">
            <div className="lf-grade">
              <Campo rotulo="Temperatura da superfície (°C)" numerico valor={dados.temperatura} aoMudar={(v) => mudar({ temperatura: v })} />
              <Campo rotulo="Condição da superfície" valor={dados.condicaoSuperficie} sugestoes={['Escovada', 'Esmerilhada', 'Pintada', 'Como soldada']} aoMudar={(v) => mudar({ condicaoSuperficie: v })} />
              <Campo rotulo="Acoplante" valor={dados.acoplante} aoMudar={(v) => mudar({ acoplante: v })} />
              <Campo rotulo="Técnica" valor={dados.tecnica} placeholder="Ex: GC = GP ± PT" aoMudar={(v) => mudar({ tecnica: v })} />
              <Campo rotulo="Bloco padrão" valor={dados.blocoPadrao} aoMudar={(v) => mudar({ blocoPadrao: v })} />
              <Campo rotulo="Bloco de referência" valor={dados.blocoReferencia} aoMudar={(v) => mudar({ blocoReferencia: v })} />
              <Campo rotulo="Tipo de junta" valor={dados.tipoJunta} aoMudar={(v) => mudar({ tipoJunta: v })} />
              <Selecao
                rotulo="Tratamento térmico"
                valor={dados.tratamentoTermico}
                vazio="Não informado"
                aoMudar={(v) => mudar({ tratamentoTermico: v as DadosUt['tratamentoTermico'] })}
                opcoes={[
                  { valor: 'antes', rotulo: 'Antes do tratamento' },
                  { valor: 'depois', rotulo: 'Depois do tratamento' },
                  { valor: 'nao_houve', rotulo: 'Não houve' },
                ]}
              />
            </div>
          </Secao>

          <Secao titulo="Aparelho">
            <div className="lf-grade">
              <Campo rotulo="Fabricante" valor={aparelho.aparelhoFabricante} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoFabricante: v }))} />
              <Campo rotulo="Modelo" valor={aparelho.aparelhoModelo} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoModelo: v }))} />
              <Campo rotulo="Número de série" valor={aparelho.aparelhoSerie} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoSerie: v }))} />
            </div>
          </Secao>

          <Secao titulo="Cabeçotes e calibração">
            <Linhas
              rotuloLinha="Cabeçote"
              textoAdicionar="Adicionar cabeçote"
              textoVazio="Nenhum cabeçote registrado."
              linhas={dados.cabecotes}
              aoMudar={(cabecotes) => mudar({ cabecotes })}
              nova={novoCabecote}
              campos={(c, alterar) => (
                <>
                  <Campo rotulo="Fabricante" valor={c.fabricante} aoMudar={(v) => alterar({ fabricante: v })} />
                  <Campo rotulo="Modelo" valor={c.modelo} aoMudar={(v) => alterar({ modelo: v })} />
                  <Campo rotulo="Número de série" valor={c.serie} aoMudar={(v) => alterar({ serie: v })} />
                  <Campo rotulo="Dimensões" valor={c.dimensoes} placeholder="Ex: 8 x 9 mm" aoMudar={(v) => alterar({ dimensoes: v })} />
                  <Campo rotulo="Ângulo real (°)" numerico valor={c.angulo} aoMudar={(v) => alterar({ angulo: v })} />
                  <Campo rotulo="Frequência (MHz)" numerico valor={c.frequencia} aoMudar={(v) => alterar({ frequencia: v })} />
                  <Campo rotulo="Espessura da peça (mm)" numerico valor={c.espessuraPeca} aoMudar={(v) => alterar({ espessuraPeca: v })} />
                  <Campo rotulo="Espessura do bloco (mm)" numerico valor={c.espessuraBloco} aoMudar={(v) => alterar({ espessuraBloco: v })} />
                  <Campo rotulo="Ganho de referência (dB)" numerico valor={c.ganhoReferencia} aoMudar={(v) => alterar({ ganhoReferencia: v })} />
                  <Campo rotulo="Ganho auxiliar (dB)" numerico valor={c.ganhoAuxiliar} aoMudar={(v) => alterar({ ganhoAuxiliar: v })} />
                  <Campo rotulo="Ganho corrigido (dB)" numerico valor={c.ganhoCorrigido} aoMudar={(v) => alterar({ ganhoCorrigido: v })} />
                  <Campo rotulo="Ganho de varredura (dB)" numerico valor={c.ganhoVarredura} aoMudar={(v) => alterar({ ganhoVarredura: v })} />
                  <Campo rotulo="Superfície" valor={c.superficie} aoMudar={(v) => alterar({ superficie: v })} />
                </>
              )}
            />
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
                  <Campo rotulo="Tipo provável" valor={i.tipoProvavel} aoMudar={(v) => alterar({ tipoProvavel: v })} />
                  <Campo rotulo="Comprimento (mm)" numerico valor={i.comprimento} aoMudar={(v) => alterar({ comprimento: v })} />
                  <Campo rotulo="Profundidade (mm)" numerico valor={i.profundidade} aoMudar={(v) => alterar({ profundidade: v })} />
                  <Campo rotulo="Percurso sônico (mm)" numerico valor={i.percursoSonico} aoMudar={(v) => alterar({ percursoSonico: v })} />
                  <Campo rotulo="Distância da borda da solda (mm)" numerico valor={i.distanciaBorda} aoMudar={(v) => alterar({ distanciaBorda: v })} />
                  <Campo rotulo="Localização a partir do ponto zero (mm)" numerico valor={i.localizacao} aoMudar={(v) => alterar({ localizacao: v })} />
                  <Campo rotulo="Superfície de inspeção" valor={i.superficie} aoMudar={(v) => alterar({ superficie: v })} />
                  <Campo rotulo="Nível da indicação, A (dB)" numerico valor={i.nivelIndicacao} aoMudar={(v) => alterar({ nivelIndicacao: v })} />
                  <Campo rotulo="Nível de referência, B (dB)" numerico valor={i.nivelReferencia} aoMudar={(v) => alterar({ nivelReferencia: v })} />
                  <Campo rotulo="Fator de atenuação, C (dB)" numerico valor={i.fatorAtenuacao} aoMudar={(v) => alterar({ fatorAtenuacao: v })} />
                  <Campo rotulo="Nível da descontinuidade, D" valor={i.nivelDescontinuidade} aoMudar={(v) => alterar({ nivelDescontinuidade: v })} />
                  <Campo rotulo="Cabeçote" valor={i.cabecote} aoMudar={(v) => alterar({ cabecote: v })} />
                  <Campo rotulo="Soldador da raiz" valor={i.soldadorRaiz} aoMudar={(v) => alterar({ soldadorRaiz: v })} />
                  <Campo rotulo="Soldador do enchimento" valor={i.soldadorEnchimento} aoMudar={(v) => alterar({ soldadorEnchimento: v })} />
                  <Selecao rotulo="Tipo de defeito" valor={i.tipoDefeito} vazio="Não informado" opcoes={TIPOS_DEFEITO} aoMudar={(v) => alterar({ tipoDefeito: v as IndicacaoUt['tipoDefeito'] })} />
                  <Selecao rotulo="Resultado" valor={i.resultado} vazio="Não informado" opcoes={[{ valor: 'A', rotulo: 'Aprovada' }, { valor: 'R', rotulo: 'Reprovada' }]} aoMudar={(v) => alterar({ resultado: v as IndicacaoUt['resultado'] })} />
                </>
              )}
            />
          </Secao>

          <BlocoFotos
            descricao="Fotos da peça, tela do aparelho e croqui da junta, cada uma com legenda."
            laudoId={base.id}
            controle={fotos}
            sugestoes={['Croqui da junta', 'Foto da junta', 'Tela do aparelho']}
          />
        </div>

        <div className="lf-coluna-secoes">
          <BlocoResponsavel base={base} aoMudar={mudarBase} metodo={METHOD} exemploSnqc="Ex: SNQC 00000 US-N2" />
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
        </fieldset>
      </form>
    </div>
  )
}
