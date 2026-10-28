export interface TenantProfile {
  name: string
  tradeName: string
  cnpj: string
  creaRegister: string
  operationalUnit: string
  contractRef: string
  reportPrefix: string
  contactEmail: string
  contactPhone: string
  logoUrl?: string
  logoScale?: number
  primaryColor?: string
}

export const DEFAULT_TENANT: TenantProfile = {
  name: 'QUALITEC INSPEÇÕES E ENGENHARIA DE INTEGRIDADE LTDA',
  tradeName: 'QUALITEC END & INSPEÇÕES',
  cnpj: '24.819.340/0001-82',
  creaRegister: 'CREA-SP 2049182 / SNQC-ABENDI 4812',
  operationalUnit: 'Polo Petroquímico / Unidade U-420',
  contractRef: 'CT-PETRO-2026/0892',
  reportPrefix: 'END',
  contactEmail: 'operacoes@qualitec-end.com.br',
  contactPhone: '(11) 3490-8800',
  logoUrl: '',
  logoScale: 100,
}
