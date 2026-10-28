import React from 'react'

export interface DocumentHeaderProps {
  /** Dados da empresa emissora (rascunho). Quando omitido, mostra aviso. */
  tenant?: {
    tradeName?: string | null
    name?: string | null
    legalName?: string | null
    cnpj?: string | null
    addressStreet?: string | null
    addressNumber?: string | null
    addressComplement?: string | null
    addressNeighborhood?: string | null
    addressCity?: string | null
    addressUf?: string | null
    addressCep?: string | null
    phone?: string | null
    contactPhone?: string | null
    email?: string | null
    contactEmail?: string | null
    logoUrl?: string | null
    logoPath?: string | null
    reportPrefix?: string | null
  }
  /** Dados congelados no momento da emissão (laudo emitido). */
  snapshot?: {
    issuerLegalName?: string | null
    issuerTradeName?: string | null
    issuerCnpj?: string | null
    issuerAddress?: string | null
    issuerPhone?: string | null
    issuerEmail?: string | null
    issuerLogoPath?: string | null
    issuerClientName?: string | null
    issuerSiteName?: string | null
    issuerSiteAddress?: string | null
    issuerContractRef?: string | null
    issuerWorkOrderCode?: string | null
  } | null
  /** Título do modelo (ex.: "Ultrassom Industrial") */
  modelTitle?: string
  /** Código do laudo (ex.: "END-US-2026-001") */
  reportCode?: string
  /** Folha atual e total (ex.: "1 de 1") */
  folio?: string
  /** Se true, suprime avisos e botões (modo impressão) */
  print?: boolean
  /** Bloco de serviço: contratante, obra, local, contrato e OS */
  service?: {
    clientName?: string | null
    siteName?: string | null
    siteAddress?: string | null
    contractRef?: string | null
    workOrderCode?: string | null
  }
}

const fmtCnpj = (cnpj?: string | null): string => {
  if (!cnpj) return ''
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  tenant,
  snapshot,
  modelTitle,
  reportCode,
  folio,
  print = false,
  service,
}) => {
  const useSnapshot = !!snapshot
  const data = useSnapshot
    ? {
        legalName: snapshot?.issuerLegalName ?? null,
        tradeName: snapshot?.issuerTradeName ?? null,
        cnpj: snapshot?.issuerCnpj ?? null,
        address: snapshot?.issuerAddress ?? null,
        phone: snapshot?.issuerPhone ?? null,
        email: snapshot?.issuerEmail ?? null,
        logoUrl: snapshot?.issuerLogoPath ?? null,
      }
    : {
        legalName: tenant?.name ?? tenant?.legalName ?? null,
        tradeName: tenant?.tradeName ?? null,
        cnpj: tenant?.cnpj ?? null,
        address: [
          tenant?.addressStreet,
          tenant?.addressNumber,
          tenant?.addressComplement,
          tenant?.addressNeighborhood,
          tenant?.addressCity,
          tenant?.addressUf,
          tenant?.addressCep,
        ]
          .filter(Boolean)
          .join(', '),
        phone: tenant?.phone ?? tenant?.contactPhone ?? null,
        email: tenant?.email ?? tenant?.contactEmail ?? null,
        logoUrl: tenant?.logoUrl ?? tenant?.logoPath ?? null,
      }

  const hasData = Boolean(data.tradeName || data.legalName || data.cnpj)

  return (
    <header
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '16px',
        alignItems: 'start',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '14px',
        marginBottom: print ? 0 : '16px',
        ...(print
          ? {
              border: 'none',
              paddingBottom: 0,
              marginBottom: 0,
              display: 'block',
            }
          : {}),
      }}
    >
      {/* Esquerda: identidade da empresa emissora */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'start', flexWrap: 'wrap' }}>
        {data.logoUrl ? (
          <img
            src={data.logoUrl}
            alt="Logo da empresa emissora"
            style={{
              maxHeight: '64px',
              maxWidth: '200px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : null}

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <strong style={{ fontSize: '16px', color: 'var(--text-primary)', lineHeight: 1.25 }}>
              {data.tradeName || data.legalName || (!print ? 'Complete em Configurações' : '')}
            </strong>
            {!hasData && !print && (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>incompleto</span>
            )}
          </div>
          {data.legalName && data.legalName !== data.tradeName && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              {data.legalName}
            </div>
          )}
          {data.cnpj && (
            <div style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: 'var(--text-muted)', marginBottom: '4px' }}>
              CNPJ {fmtCnpj(data.cnpj)}
            </div>
          )}
          {data.address && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
              {data.address}
            </div>
          )}
          {(data.phone || data.email) && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '10px', alignItems: 'center' }}>
              {data.phone && <span>☎ {data.phone}</span>}
              {data.email && <span>✉ {data.email}</span>}
            </div>
          )}
          {!hasData && !print && (
            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '6px' }}>
              Complete os dados da empresa em Configurações para aparecer no laudo.
            </div>
          )}
        </div>
      </div>

      {/* Bloco de serviço: contratante, obra, local, contrato, OS */}
      {!print && service && (
        <div style={{ gridColumn: '1 / -1', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {service.clientName && (
              <span style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Contratante:</span>
                {service.clientName}
              </span>
            )}
            {service.siteName && (
              <span style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Obra:</span>
                {service.siteName}
              </span>
            )}
            {service.siteAddress && (
              <span style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Local:</span>
                {service.siteAddress}
              </span>
            )}
            {service.contractRef && (
              <span style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Contrato:</span>
                {service.contractRef}
              </span>
            )}
            {service.workOrderCode && (
              <span style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>OS:</span>
                {service.workOrderCode}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Direita: modelo, código e folha */}
      <div
        style={{
          textAlign: 'right',
          ...(print ? { marginTop: '8px' } : {}),
        }}
      >
        {modelTitle && (
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {modelTitle}
          </div>
        )}
        {reportCode && (
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {reportCode}
          </div>
        )}
        {folio && (
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--text-muted)' }}>
            Folha {folio}
          </div>
        )}
      </div>
    </header>
  )
}
