import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSearch, ShieldCheck, XCircle } from 'lucide-react'
import { API_BASE_URL } from '../config'

// Página pública aberta pelo QR do PDF oficial: /verificar/{documento}/{revisão}.
// Não pede login. O arquivo conferido nunca sai do aparelho: o SHA-256 é calculado no navegador.

interface Verificacao {
  situacao: 'valido' | 'substituido'
  numero: string | null
  revisao: number
  revisao_vigente: number
  metodo: string | null
  emitido_em: string | null
  emissora: { nome: string | null; cnpj: string | null }
  sha256_conteudo: string | null
  sha256_pdf: string | null
}

type Estado = { tipo: 'carregando' } | { tipo: 'ok'; dados: Verificacao } | { tipo: 'nao-encontrado' } | { tipo: 'erro'; mensagem: string }

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : ''

async function sha256DoArquivo(arquivo: File): Promise<string> {
  const resumo = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer())
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const VerificarPage: React.FC = () => {
  const [, , documento = '', revisao = ''] = window.location.pathname.split('/')
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [conferencia, setConferencia] = useState<{ nome: string; igual: boolean } | null>(null)
  const [conferindo, setConferindo] = useState(false)

  useEffect(() => {
    document.title = 'Verificar laudo | AXOS Relatórios'
    void (async () => {
      try {
        const resposta = await fetch(`${API_BASE_URL}/api/verificar/${encodeURIComponent(documento)}/${encodeURIComponent(revisao)}`)
        if (resposta.status === 404 || resposta.status === 422) return setEstado({ tipo: 'nao-encontrado' })
        if (!resposta.ok) {
          const corpo = await resposta.json().catch(() => ({}))
          return setEstado({ tipo: 'erro', mensagem: String(corpo.detail ?? 'Não foi possível consultar agora. Tente de novo em instantes.') })
        }
        setEstado({ tipo: 'ok', dados: (await resposta.json()) as Verificacao })
      } catch {
        setEstado({ tipo: 'erro', mensagem: 'Sem conexão com o servidor. Confira a internet e tente de novo.' })
      }
    })()
  }, [documento, revisao])

  const conferir = async (arquivo: File | undefined) => {
    if (!arquivo || estado.tipo !== 'ok' || !estado.dados.sha256_pdf) return
    setConferindo(true)
    const hash = await sha256DoArquivo(arquivo)
    setConferencia({ nome: arquivo.name, igual: hash === estado.dados.sha256_pdf })
    setConferindo(false)
  }

  return (
    <main className="verificar-pagina">
      <header className="verificar-topo">
        <img src="/logo-axos.png" alt="AXOS Relatórios" />
        <h1><ShieldCheck size={22} strokeWidth={1.75} aria-hidden="true" /> Verificação de laudo</h1>
      </header>

      {estado.tipo === 'carregando' && <p className="lf-descricao" role="status">Consultando o registro do laudo...</p>}

      {estado.tipo === 'nao-encontrado' && (
        <section className="lf-secao verificar-situacao verificar-ruim" role="alert">
          <h2><XCircle size={20} strokeWidth={1.75} aria-hidden="true" /> Laudo não encontrado</h2>
          <p>Não existe laudo emitido com este código. Confira se o endereço ou o código QR está completo. Se o problema continuar, peça ao emissor uma cópia do laudo.</p>
        </section>
      )}

      {estado.tipo === 'erro' && (
        <section className="lf-secao verificar-situacao" role="alert">
          <h2>Não foi possível verificar agora</h2>
          <p>{estado.mensagem}</p>
        </section>
      )}

      {estado.tipo === 'ok' && (
        <>
          {estado.dados.situacao === 'valido' ? (
            <section className="lf-secao verificar-situacao verificar-bom" role="status">
              <h2><CheckCircle2 size={20} strokeWidth={1.75} aria-hidden="true" /> Laudo autêntico e vigente</h2>
              <p>Este laudo está registrado no AXOS Relatórios e esta é a revisão em vigor.</p>
            </section>
          ) : (
            <section className="lf-secao verificar-situacao verificar-atencao" role="alert">
              <h2><AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" /> Laudo substituído</h2>
              <p>Este laudo foi registrado, mas foi substituído pela <strong>revisão {estado.dados.revisao_vigente}</strong>. Peça ao emissor a revisão mais nova.</p>
            </section>
          )}

          <section className="lf-secao">
            <h2>Dados do registro</h2>
            <dl className="verificar-dados">
              <div><dt>Número do laudo</dt><dd>{estado.dados.numero}</dd></div>
              <div><dt>Revisão</dt><dd>{estado.dados.revisao}</dd></div>
              <div><dt>Método</dt><dd>{estado.dados.metodo}</dd></div>
              <div><dt>Emitido em</dt><dd>{dataHora(estado.dados.emitido_em)}</dd></div>
              <div><dt>Empresa emissora</dt><dd>{estado.dados.emissora.nome}{estado.dados.emissora.cnpj ? `, CNPJ ${estado.dados.emissora.cnpj}` : ''}</dd></div>
              <div className="verificar-hash"><dt>SHA-256 do conteúdo</dt><dd>{estado.dados.sha256_conteudo}</dd></div>
              <div className="verificar-hash"><dt>SHA-256 do PDF oficial</dt><dd>{estado.dados.sha256_pdf ?? 'PDF ainda não gerado'}</dd></div>
            </dl>
          </section>

          {estado.dados.sha256_pdf && (
            <section className="lf-secao">
              <h2>Conferir o arquivo que você recebeu</h2>
              <p className="lf-descricao">Escolha o PDF. O seu aparelho calcula o código SHA-256 e compara com o original. O arquivo não é enviado a lugar nenhum.</p>
              <label className="lf-botao lf-botao-primario verificar-arquivo">
                <FileSearch size={16} strokeWidth={1.75} aria-hidden="true" /> {conferindo ? 'Conferindo...' : 'Escolher o PDF'}
                <input type="file" accept="application/pdf,.pdf" onChange={(e) => { void conferir(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {conferencia && (conferencia.igual ? (
                <p className="verificar-resultado verificar-bom" role="status"><CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" /> O arquivo "{conferencia.nome}" é idêntico ao PDF oficial.</p>
              ) : (
                <p className="verificar-resultado verificar-ruim" role="alert"><XCircle size={18} strokeWidth={1.75} aria-hidden="true" /> O arquivo "{conferencia.nome}" NÃO é idêntico ao PDF oficial. Ele foi alterado ou é outro documento.</p>
              ))}
            </section>
          )}
        </>
      )}

      <p className="verificar-rodape">
        A verificação confirma que o documento corresponde ao registro do sistema AXOS Relatórios. Ela não substitui assinatura digital ICP-Brasil.
      </p>
    </main>
  )
}
