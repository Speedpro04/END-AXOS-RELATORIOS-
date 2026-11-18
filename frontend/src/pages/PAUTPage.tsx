import React, { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { METHOD_LABELS, type ENDMethod, type InspectionReport } from '../types/inspection'
import {
  TIPOS_DEFEITO,
  paraNumero,
  resumirMedicoes,
  separarMedicoes,
  type AparelhoEnsaio,
  type DadosPaut,
  type IdentificacaoEnsaio,
  type IndicacaoPaut,
} from '../types/laudoEnsaio'
import { useAuth } from '../contexts/AuthContext'
import { ObraEscopoVinculo } from '../components/laudo/ObraEscopoVinculo'
import { FluxoLaudo } from '../components/laudo/FluxoLaudo'
import {
  AreaTexto,
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

const METHOD: ENDMethod = 'PAUT'

interface LaudoPageProps {
  onBack: () => void
  onSave: (report: Partial<InspectionReport>) => Promise<void>
  initialReport?: InspectionReport | null
  siteId?: string | null
}

const novaIndicacao = (): IndicacaoPaut => ({
  id: crypto.randomUUID(), identificacao: '', posicao: '', comprimento: '', profundidade: '', tipoDefeito: '', resultado: '',
})

const formatar = (n: number | null) => (n === null ? '—' : `${n.toFixed(2).replace('.', ',')} mm`)

type Especifico = Omit<DadosPaut, 'esquema' | 'fotos' | keyof IdentificacaoEnsaio | keyof AparelhoEnsaio>

export const PAUTPage: React.FC<LaudoPageProps> = ({ onBack, onSave, initialReport, siteId }) => {
  const { profile } = useAuth()
  const salvo = initialReport?.technicalData as Partial<DadosPaut> | undefined
  const [base, setBase] = useState(() => baseInicial(METHOD, initialReport, profile?.full_name))
  const [ident, setIdent] = useState(() => identificacaoInicial(salvo))
  const [aparelho, setAparelho] = useState<AparelhoEnsaio>({
    aparelhoFabricante: salvo?.aparelhoFabricante ?? '',
    aparelhoModelo: salvo?.aparelhoModelo ?? '',
    aparelhoSerie: salvo?.aparelhoSerie ?? '',
  })
  const [dados, setDados] = useState<Especifico>({
    modo: salvo?.modo ?? 'solda',
    sonda: salvo?.sonda ?? '',
    cunha: salvo?.cunha ?? '',
    ganhoPrimario: salvo?.ganhoPrimario ?? '',
    ganhoVarredura: salvo?.ganhoVarredura ?? '',
    ganhoAvaliacao: salvo?.ganhoAvaliacao ?? '',
    tipoJunta: salvo?.tipoJunta ?? '',
    diametroExterno: salvo?.diametroExterno ?? '',
    espessura: salvo?.espessura ?? '',
    indicacoes: salvo?.indicacoes ?? [],
    tubo: salvo?.tubo ?? '',
    espessuraNominal: salvo?.espessuraNominal ?? '',
    comprimentoVarredura: salvo?.comprimentoVarredura ?? '',
    espessuraMinima: salvo?.espessuraMinima ?? '',
    medicoes: salvo?.medicoes ?? [],
  })
  const fotos = useFotos(salvo?.fotos)
  const [colagem, setColagem] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mudarBase = (parcial: Partial<typeof base>) => setBase((b) => ({ ...b, ...parcial }))
  const mudar = (parcial: Partial<Especifico>) => setDados((d) => ({ ...d, ...parcial }))
  const emSolda = dados.modo === 'solda'
  const resumo = useMemo(() => resumirMedicoes(dados.medicoes, dados.espessuraMinima), [dados.medicoes, dados.espessuraMinima])
  const abaixo = useMemo(() => new Set(resumo.abaixoDoLimite), [resumo.abaixoDoLimite])
  const temReprovada = emSolda ? dados.indicacoes.some((i) => i.resultado === 'R') : resumo.abaixoDoLimite.length > 0

  const incluirColagem = () => {
    const valores = separarMedicoes(colagem)
    if (valores.length === 0) return
    mudar({ medicoes: [...dados.medicoes, ...valores] })
    setColagem('')
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const fotosSalvas = await fotos.persistir(base.id)
      const tecnico: DadosPaut & { observacoes: string; conclusao: string } = {
        ...salvo,
        esquema: 'paut-v1',
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
        title: `${METHOD_LABELS[METHOD].full} ${emSolda ? 'em solda' : 'de espessura'}: ${base.equipmentTag}`,
        equipmentTag: base.equipmentTag.toUpperCase(),
        unitArea: base.local,
        inspectorName: base.inspetor,
        inspectorSNQC: base.snqc,
        qualificationId: base.qualificacaoId,
        normProcedure: base.norma,
        acceptanceCriteria: base.criterio,
        status: base.veredito,
        findingsCount: emSolda ? dados.indicacoes.length : resumo.abaixoDoLimite.length,
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
          <Secao titulo="Tipo de ensaio">
            <div className="lf-grade">
              <Selecao
                rotulo="O que está sendo ensaiado"
                valor={dados.modo}
                aoMudar={(v) => mudar({ modo: v as DadosPaut['modo'] })}
                opcoes={[
                  { valor: 'solda', rotulo: 'Solda' },
                  { valor: 'espessura', rotulo: 'Espessura (B-scan)' },
                ]}
              />
            </div>
          </Secao>

          <BlocoIdentificacao base={base} aoMudarBase={mudarBase} ident={ident} aoMudarIdent={(p) => setIdent((i) => ({ ...i, ...p }))} />

          <Secao titulo="Aparelho e calibração">
            <div className="lf-grade">
              <Campo rotulo="Fabricante do aparelho" valor={aparelho.aparelhoFabricante} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoFabricante: v }))} />
              <Campo rotulo="Modelo do aparelho" valor={aparelho.aparelhoModelo} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoModelo: v }))} />
              <Campo rotulo="Número de série" valor={aparelho.aparelhoSerie} aoMudar={(v) => setAparelho((a) => ({ ...a, aparelhoSerie: v }))} />
              <Campo rotulo="Sonda" valor={dados.sonda} aoMudar={(v) => mudar({ sonda: v })} />
              <Campo rotulo="Cunha" valor={dados.cunha} aoMudar={(v) => mudar({ cunha: v })} />
              <Campo rotulo="Ganho primário (dB)" numerico valor={dados.ganhoPrimario} aoMudar={(v) => mudar({ ganhoPrimario: v })} />
              <Campo rotulo="Ganho de varredura (dB)" numerico valor={dados.ganhoVarredura} aoMudar={(v) => mudar({ ganhoVarredura: v })} />
              <Campo rotulo="Ganho de avaliação (dB)" numerico valor={dados.ganhoAvaliacao} aoMudar={(v) => mudar({ ganhoAvaliacao: v })} />
            </div>
          </Secao>

          {emSolda ? (
            <>
              <Secao titulo="Junta">
                <div className="lf-grade">
                  <Selecao
                    rotulo="Tipo de junta"
                    valor={dados.tipoJunta}
                    vazio="Não informado"
                    aoMudar={(v) => mudar({ tipoJunta: v as DadosPaut['tipoJunta'] })}
                    opcoes={[
                      { valor: 'longitudinal', rotulo: 'Longitudinal' },
                      { valor: 'circunferencial', rotulo: 'Circunferencial' },
                    ]}
                  />
                  <Campo rotulo="Diâmetro externo (mm)" numerico valor={dados.diametroExterno} aoMudar={(v) => mudar({ diametroExterno: v })} />
                  <Campo rotulo="Espessura (mm)" numerico valor={dados.espessura} aoMudar={(v) => mudar({ espessura: v })} />
                </div>
              </Secao>
              <Secao titulo="Registro dos resultados" descricao="Se não houver descontinuidade, deixe em branco.">
                <Linhas
                  rotuloLinha="Indicação"
                  textoAdicionar="Adicionar indicação"
                  textoVazio="Nenhuma descontinuidade registrada."
                  linhas={dados.indicacoes}
                  aoMudar={(indicacoes) => mudar({ indicacoes })}
                  nova={novaIndicacao}
                  campos={(i, alterar) => (
                    <>
                      <Campo rotulo="Junta" valor={i.identificacao} aoMudar={(v) => alterar({ identificacao: v })} />
                      <Campo rotulo="Posição" valor={i.posicao} sugestoes={['SK 90', 'SK 270']} aoMudar={(v) => alterar({ posicao: v })} />
                      <Campo rotulo="Comprimento (mm)" numerico valor={i.comprimento} aoMudar={(v) => alterar({ comprimento: v })} />
                      <Campo rotulo="Profundidade (mm)" numerico valor={i.profundidade} aoMudar={(v) => alterar({ profundidade: v })} />
                      <Selecao rotulo="Tipo de defeito" valor={i.tipoDefeito} vazio="Não informado" opcoes={TIPOS_DEFEITO} aoMudar={(v) => alterar({ tipoDefeito: v as IndicacaoPaut['tipoDefeito'] })} />
                      <Selecao rotulo="Resultado" valor={i.resultado} vazio="Não informado" opcoes={[{ valor: 'A', rotulo: 'Aprovada' }, { valor: 'R', rotulo: 'Reprovada' }]} aoMudar={(v) => alterar({ resultado: v as IndicacaoPaut['resultado'] })} />
                    </>
                  )}
                />
              </Secao>
            </>
          ) : (
            <>
              <Secao titulo="Peça">
                <div className="lf-grade">
                  <Campo rotulo="Tubo ou diâmetro" valor={dados.tubo} placeholder={'Ex: 3"'} aoMudar={(v) => mudar({ tubo: v })} />
                  <Campo rotulo="Espessura nominal (mm)" numerico valor={dados.espessuraNominal} aoMudar={(v) => mudar({ espessuraNominal: v })} />
                  <Campo rotulo="Comprimento de varredura (mm)" numerico valor={dados.comprimentoVarredura} aoMudar={(v) => mudar({ comprimentoVarredura: v })} />
                  <Campo rotulo="Espessura mínima aceita (mm)" numerico valor={dados.espessuraMinima} aoMudar={(v) => mudar({ espessuraMinima: v })} />
                </div>
              </Secao>
              <Secao titulo="Medições de espessura" descricao="Digite ponto a ponto ou cole a lista de uma vez.">
                <div className="lf-resumo" aria-live="polite">
                  <div><span>Pontos</span><strong>{resumo.total}</strong></div>
                  <div><span>Mínima</span><strong>{formatar(resumo.minimo)}</strong></div>
                  <div><span>Máxima</span><strong>{formatar(resumo.maximo)}</strong></div>
                  <div><span>Média</span><strong>{formatar(resumo.media)}</strong></div>
                </div>
                {paraNumero(dados.espessuraMinima) === null && resumo.total > 0 && (
                  <p className="lf-descricao">Informe a espessura mínima aceita para o sistema destacar os pontos abaixo dela.</p>
                )}
                {resumo.abaixoDoLimite.length > 0 && (
                  <p className="lf-alerta" role="alert">
                    {resumo.abaixoDoLimite.length === 1 ? '1 ponto abaixo' : `${resumo.abaixoDoLimite.length} pontos abaixo`} da espessura mínima: {resumo.abaixoDoLimite.join(', ')}.
                  </p>
                )}
                <div className="lf-medicoes">
                  {dados.medicoes.map((m, i) => (
                    <div className={`lf-medicao${abaixo.has(i + 1) ? ' lf-medicao-baixa' : ''}`} key={i}>
                      <label htmlFor={`medicao-${i}`}>{i + 1}</label>
                      <input
                        id={`medicao-${i}`}
                        inputMode="decimal"
                        value={m}
                        aria-label={`Ponto ${i + 1}, espessura em milímetros${abaixo.has(i + 1) ? ', abaixo da mínima' : ''}`}
                        onChange={(e) => mudar({ medicoes: dados.medicoes.map((v, j) => (j === i ? e.target.value : v)) })}
                      />
                      <button type="button" aria-label={`Remover ponto ${i + 1}`} onClick={() => mudar({ medicoes: dados.medicoes.filter((_, j) => j !== i) })}>
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="lf-linha-botoes">
                  <button type="button" className="lf-botao" onClick={() => mudar({ medicoes: [...dados.medicoes, ''] })}>
                    <Plus size={16} strokeWidth={1.75} /> Adicionar ponto
                  </button>
                </div>
                <AreaTexto rotulo="Colar lista de medições" linhas={3} placeholder="Ex: 4,9 4,8 4,9 4,5" valor={colagem} aoMudar={setColagem} />
                <div className="lf-linha-botoes">
                  <button type="button" className="lf-botao" disabled={!colagem.trim()} onClick={incluirColagem}>Incluir lista</button>
                </div>
              </Secao>
            </>
          )}

          <BlocoFotos
            descricao={emSolda ? 'Croqui da peça e telas do aparelho, cada um com legenda.' : 'Desenho técnico com o mapa dos pontos e tela do aparelho, cada um com legenda.'}
            laudoId={base.id}
            controle={fotos}
            sugestoes={emSolda ? ['Croqui', 'SK 90', 'SK 270'] : ['Desenho técnico', 'Imagem do B-scan']}
          />
        </div>

        <div className="lf-coluna-secoes">
          <BlocoResponsavel base={base} aoMudar={mudarBase} metodo={METHOD} exemploSnqc="Ex: SNQC 00000 US-N2 / Phased Array" />
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
          <BlocoConclusao base={base} aoMudar={mudarBase} temReprovada={temReprovada} aviso={emSolda ? undefined : 'Atenção: há ponto abaixo da espessura mínima, mas o laudo está como aprovado.'} erro={erro} salvando={salvando} aoCancelar={onBack} />
        </div>
        </fieldset>
      </form>
    </div>
  )
}
