import React, { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CornerUpLeft, Download, FilePlus2, FileCog, Send, Stamp } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../services/dbDexie'
import { aprovar, baixarPdfOficial, devolver, emitir, enviarParaRevisao, gerarPdfOficial, lerSituacao, novaRevisao, ultimoComentario, type Resultado, type SituacaoLaudo, type StatusServidor } from '../../services/fluxoLaudo'
import { AreaTexto, Secao } from './CamposLaudo'

// Situação do laudo no servidor e as ações de cada etapa, conforme quem está usando.
// Em revisão, aprovado ou emitido, o formulário fica só para leitura (onBloqueio).

const TRAVADOS: StatusServidor[] = ['submitted', 'approved', 'issued', 'superseded']
const SERVIDOR_DO_LOCAL: Record<string, StatusServidor> = {
  rascunho: 'draft', enviado: 'submitted', returned: 'returned', aprovado: 'approved', issued: 'issued', superseded: 'superseded',
}
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '')

export const FluxoLaudo: React.FC<{ laudoId: string; onBloqueio: (bloqueado: boolean) => void }> = ({ laudoId, onBloqueio }) => {
  const { user, profile } = useAuth()
  const revisor = profile?.role === 'admin' || profile?.role === 'supervisor'
  const [situacao, setSituacao] = useState<SituacaoLaudo | null | 'sem-conexao'>(null)
  const [statusLocal, setStatusLocal] = useState<StatusServidor | null>(null)
  const [numeroLocal, setNumeroLocal] = useState<string | null>(null)
  const [foraDeObra, setForaDeObra] = useState(false)
  const [registrado, setRegistrado] = useState(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [devolvendo, setDevolvendo] = useState(false)
  const [textoDevolucao, setTextoDevolucao] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [semPdf, setSemPdf] = useState(false)

  const carregar = useCallback(async () => {
    const local = await db.reports.get(laudoId)
    setRegistrado(!!local)
    setForaDeObra(!!local && !local.workOrderId)
    const doLocal = local?.serverStatus ? SERVIDOR_DO_LOCAL[local.serverStatus] ?? null : null
    setStatusLocal(doLocal)
    setNumeroLocal(local?.reportNumber ?? null)
    const remota = await lerSituacao(laudoId)
    setSituacao(remota)
    const status = remota && remota !== 'sem-conexao' ? remota.status : doLocal
    onBloqueio(!!status && TRAVADOS.includes(status))
    setMotivo(status === 'returned' && remota !== 'sem-conexao' ? await ultimoComentario(laudoId) : null)
  }, [laudoId, onBloqueio])

  useEffect(() => { void carregar() }, [carregar])

  const executar = async (acao: () => Promise<Resultado & { semPdf?: boolean }>) => {
    setOcupado(true)
    setResultado(null)
    const r = await acao()
    setResultado(r)
    setSemPdf(!r.ok && !!r.semPdf)
    setOcupado(false)
    if (r.ok) {
      setDevolvendo(false)
      setTextoDevolucao('')
      await carregar()
    }
  }

  const remota = situacao && situacao !== 'sem-conexao' ? situacao : null
  const status: StatusServidor | null = remota?.status ?? statusLocal
  const dono = !remota || remota.inspector_id === user?.id

  let texto: string
  if (!registrado) texto = 'Laudo novo. Registre para salvar. Depois, se ele estiver numa obra, envie para revisão.'
  else if (foraDeObra) texto = 'Rascunho guardado só neste aparelho: o laudo foi feito fora de uma obra e não vai para o servidor.'
  else if (!status) texto = situacao === 'sem-conexao' ? 'Rascunho. Sem conexão para consultar o servidor agora.' : 'Rascunho, ainda subindo para o servidor.'
  else {
    texto = {
      draft: 'Rascunho no servidor.',
      submitted: `Em revisão${remota?.submitted_at ? ` desde ${dataHora(remota.submitted_at)}` : ''}. O laudo não pode ser alterado.`,
      returned: 'Devolvido pelo revisor para correção.',
      approved: 'Aprovado. Aguardando emissão.',
      issued: `Emitido${(remota?.report_number ?? numeroLocal) ? `: nº ${remota?.report_number ?? numeroLocal}` : ''}${remota ? `, revisão ${remota.revision}` : ''}${remota?.issued_at ? `, em ${dataHora(remota.issued_at)}` : ''}. Laudo travado: correções só por nova revisão.`,
      superseded: 'Substituído por uma revisão mais nova. Vale a revisão mais recente.',
    }[status]
  }

  const podeEnviar = registrado && !foraDeObra && dono && (status === null || status === 'draft' || status === 'returned')

  return (
    <div className="lf-fluxo">
    <Secao titulo="Situação do laudo">
      <p className="lf-descricao" role="status"><strong>{texto}</strong></p>
      {status === 'returned' && motivo && <p className="lf-alerta">Motivo da devolução: {motivo}</p>}

      <div className="lf-linha-botoes">
        {podeEnviar && (
          <button type="button" className="lf-botao lf-botao-primario" disabled={ocupado} onClick={() => void executar(() => enviarParaRevisao(laudoId))}>
            <Send size={16} strokeWidth={1.75} /> {ocupado ? 'Enviando...' : 'Enviar para revisão'}
          </button>
        )}
        {revisor && status === 'submitted' && !devolvendo && (
          <>
            <button type="button" className="lf-botao lf-botao-primario" disabled={ocupado} onClick={() => void executar(() => aprovar(laudoId))}>
              <CheckCircle2 size={16} strokeWidth={1.75} /> Aprovar
            </button>
            <button type="button" className="lf-botao" disabled={ocupado} onClick={() => setDevolvendo(true)}>
              <CornerUpLeft size={16} strokeWidth={1.75} /> Devolver
            </button>
          </>
        )}
        {revisor && status === 'approved' && (
          <button type="button" className="lf-botao lf-botao-primario" disabled={ocupado} onClick={() => void executar(() => emitir(laudoId))}>
            <Stamp size={16} strokeWidth={1.75} /> {ocupado ? 'Emitindo...' : 'Emitir laudo'}
          </button>
        )}
        {(status === 'issued' || status === 'superseded') && (
          <button type="button" className="lf-botao lf-botao-primario" disabled={ocupado} onClick={() => void executar(() => baixarPdfOficial(laudoId))}>
            <Download size={16} strokeWidth={1.75} /> Baixar PDF oficial
          </button>
        )}
        {revisor && semPdf && (status === 'issued' || status === 'superseded') && (
          <button type="button" className="lf-botao" disabled={ocupado} onClick={() => void executar(() => gerarPdfOficial(laudoId))}>
            <FileCog size={16} strokeWidth={1.75} /> Gerar PDF oficial
          </button>
        )}
        {status === 'issued' && (
          <button type="button" className="lf-botao" disabled={ocupado} onClick={() => void executar(() => novaRevisao(laudoId))}>
            <FilePlus2 size={16} strokeWidth={1.75} /> Nova revisão
          </button>
        )}
      </div>

      {podeEnviar && <p className="lf-descricao">Envia a última versão registrada. Se mudou algo, clique em Registrar laudo antes.</p>}

      {devolvendo && (
        <div className="lf-coluna">
          <AreaTexto rotulo="Motivo da devolução (o inspetor vê este texto)" valor={textoDevolucao} aoMudar={setTextoDevolucao} linhas={3} />
          <div className="lf-linha-botoes">
            <button type="button" className="lf-botao lf-botao-primario" disabled={ocupado || !textoDevolucao.trim()}
              onClick={() => profile?.tenant_id && void executar(() => devolver(laudoId, profile.tenant_id, textoDevolucao))}>
              <CornerUpLeft size={16} strokeWidth={1.75} /> Confirmar devolução
            </button>
            <button type="button" className="lf-botao" disabled={ocupado} onClick={() => { setDevolvendo(false); setTextoDevolucao('') }}>Cancelar</button>
          </div>
        </div>
      )}

      {resultado && <p className={resultado.ok ? 'lf-descricao' : 'lf-alerta'} role={resultado.ok ? 'status' : 'alert'}>{resultado.mensagem}</p>}
    </Secao>
    </div>
  )
}
