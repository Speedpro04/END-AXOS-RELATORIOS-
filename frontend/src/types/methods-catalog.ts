// =====================================================================
// AXOS RELATÓRIOS — Catálogo de métodos END
// Fonte: métodos END listados pela ABENDI.
// Conformidade: ISO 27001 (segurança da informação), ISO 9001 (qualidade),
// ABNT (normas técnicas brasileiras).
// Controle de mudança: todo ajuste deve ser revisado por profissional
// qualificado antes de expor em tela ou laudo (normaStatus 'validar').
// =====================================================================

export type MethodCode =
  | 'LP' | 'PM' | 'EMAG'
  | 'US' | 'ME' | 'USAV' | 'USIMG' | 'IRIS'
  | 'RADIO' | 'RADIOM'
  | 'EVS' | 'VT' | 'VIS' | 'DIM'
  | 'PINT' | 'HOLIDAY'
  | 'LT' | 'AE'
  | 'PMI' | 'ESPEC' | 'REP' | 'TT'
  | 'TERMO' | 'VIBR'
  | 'NR13_VASO' | 'EQUIP' | 'DUTOS' | 'PIG' | 'SUBAQ' | 'AIE' | 'ATEX'
  | 'FABRIC' | 'CORDA'

export interface MethodCatalogItem {
  id: string
  code: MethodCode
  name: string
  norm: string
  chips: string[]
  aliases: string[]
  groupId: string
  route: string
  available: boolean
  count?: number
  kind?: 'tecnica' | 'inspecao' | 'servico'
  engine?: 'dedicated' | 'config'
  phase?: 1 | 2 | 3
  normaStatus?: 'validar'
  // Auditoria (ISO 27001 A.12.1.2 - Gestão de mudanças; ISO 9001 7.5 - Informação documentada)
  version: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface MethodGroup {
  id: string
  name: string
  accentColor: string
  methods: MethodCatalogItem[]
}

type New = Pick<MethodCatalogItem, 'code' | 'name' | 'norm' | 'groupId' | 'route'> &
  { kind: 'tecnica' | 'inspecao' | 'servico'; phase: 1 | 2 | 3; chips: string[]; aliases: string[] }

const novo = (m: New): MethodCatalogItem => ({
  id: m.code,
  available: false,
  engine: 'config',
  normaStatus: 'validar',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'sistema',
  updatedBy: 'sistema',
  ...m,
})

export const METHODS_CATALOG: MethodCatalogItem[] = [
  { id: 'LP', code: 'LP', name: 'Líquido Penetrante', norm: 'ASME V Art. 6 / Petrobras N-1596',
    chips: ['ensaio', 'superficial', 'penetrante', 'indicações'], aliases: ['liquido penetrante', 'penetrante', 'lp'],
    groupId: 'superficie', route: 'lp', available: true, kind: 'tecnica', engine: 'dedicated',
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  { id: 'PM', code: 'PM', name: 'Partícula Magnética', norm: 'Petrobras N-1598 / ASME VIII Ap. 6',
    chips: ['subsuperficial', 'ferromagnetico', 'yoke', 'fluorescente'], aliases: ['particula magnetica', 'pm'],
    groupId: 'superficie', route: 'pm', available: true, kind: 'tecnica', engine: 'dedicated',
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  { id: 'US', code: 'US', name: 'Ultrassom Industrial', norm: 'ASME V Art. 4 / Petrobras N-1594',
    chips: ['volumetrico', 'juntas', 'feixe', 'angular'], aliases: ['ultrassom industrial', 'ultrassom convencional', 'us'],
    groupId: 'ultrassom', route: 'us', available: true, kind: 'tecnica', engine: 'dedicated',
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  { id: 'ME', code: 'ME', name: 'Medição de Espessura (USME)', norm: 'Petrobras N-1594 / ASME V Art. 5',
    chips: ['espessura', 'malha', 'corrosao', 'vida remanescente'], aliases: ['medicao espessura', 'usme', 'me'],
    groupId: 'ultrassom', route: 'me', available: true, kind: 'tecnica', engine: 'dedicated',
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  { id: 'RADIO', code: 'RADIO', name: 'Radiografia Industrial', norm: '',
    chips: ['radiografia', 'industrial', 'RX', 'raios gama'], aliases: ['radiografia', 'radiografico', 'rx', 'radio', 'rt'],
    groupId: 'radiografico', route: 'radio', available: false, kind: 'tecnica', engine: 'config', phase: 3,
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  { id: 'EVS', code: 'EVS', name: 'Inspeção Visual de Solda', norm: 'AWS D1.1 / ASME B31.3',
    chips: ['visual', 'solda', 'checklist', 'EPS WPS'], aliases: ['inspecao visual de solda', 'inspecao de soldagem', 'evs'],
    groupId: 'visual-solda', route: 'evs', available: true, kind: 'tecnica', engine: 'dedicated',
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  { id: 'PINT', code: 'PINT', name: 'Pintura & Aderência', norm: 'Petrobras N-13 / ISO 8501',
    chips: ['pintura', 'aderencia', 'rugosidade', 'dft'], aliases: ['pintura aderencia', 'inspetor de pintura', 'pint'],
    groupId: 'pintura-revestimento', route: 'pintura', available: true, kind: 'tecnica', engine: 'dedicated',
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  { id: 'NR13_VASO', code: 'NR13_VASO', name: 'Vaso de Pressão (NR-13)', norm: 'NR-13 MTE / ASME Sec. VIII',
    chips: ['vaso', 'pressao', 'nr13', 'pmta'], aliases: ['vaso de pressao', 'inspecao seguranca nr13', 'nr13'],
    groupId: 'vasos-pressao', route: 'nr13', available: true, kind: 'inspecao', engine: 'dedicated',
    version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'sistema', updatedBy: 'sistema' },
  novo({ code: 'EMAG', name: 'Inspeção Eletromagnética', norm: 'ASME V Art. 8', groupId: 'superficie', route: 'eletromagnetica',
    kind: 'tecnica', phase: 2, chips: ['correntes parasitas', 'campo remoto', 'MFL', 'tubos'],
    aliases: ['correntes parasitas', 'eddy current', 'campo remoto', 'mfl', 'eletromagnetica'] }),
  novo({ code: 'USAV', name: 'Ultrassom Avançado', norm: 'ASME V Art. 4 / ISO 13588 / ISO 10863', groupId: 'ultrassom', route: 'ultrassom-avancado',
    kind: 'tecnica', phase: 2, chips: ['phased array', 'TOFD', 'TFM', 'PCI', 'PWI'],
    aliases: ['phased array', 'paut', 'tofd', 'tfm', 'pci', 'pwi', 'ultrassom avancado'] }),
  novo({ code: 'USIMG', name: 'Ultrassom com Imagens (B e C-scan)', norm: '', groupId: 'ultrassom', route: 'ultrassom-imagens',
    kind: 'tecnica', phase: 3, chips: ['b-scan', 'c-scan', 'mapeamento', 'imagem'],
    aliases: ['b-scan', 'c-scan', 'bscan', 'cscan', 'ultrassom com imagens'] }),
  novo({ code: 'IRIS', name: 'Ultrassom IRIS', norm: '', groupId: 'ultrassom', route: 'iris',
    kind: 'tecnica', phase: 3, chips: ['iris', 'tubos', 'trocador de calor', 'perda de parede'],
    aliases: ['iris', 'ultrassom iris', 'inspecao interna de tubos'] }),
  novo({ code: 'RADIOM', name: 'Radiometria (Medição de Radiação)', norm: '', groupId: 'radiografico', route: 'radiometria',
    kind: 'tecnica', phase: 3, chips: ['radiometria', 'levantamento radiometrico', 'dose', 'area controlada'],
    aliases: ['radiometria', 'medicao de radiacao', 'levantamento radiometrico'] }),
  novo({ code: 'VT', name: 'Ensaio Visual (EV)', norm: 'ASME V Art. 9', groupId: 'visual-solda', route: 'visual',
    kind: 'tecnica', phase: 1, chips: ['visual', 'checklist', 'registro fotografico', 'superficie'],
    aliases: ['ensaio visual', 'inspecao visual', 'ev', 'vt'] }),
  novo({ code: 'VIS', name: 'Boroscopia / Endoscopia / Videoscopia', norm: 'ASME V Art. 9', groupId: 'visual-solda', route: 'boroscopia',
    kind: 'tecnica', phase: 2, chips: ['boroscopia', 'endoscopia', 'videoscopia', 'inspecao remota'],
    aliases: ['boroscopia', 'endoscopia', 'videoscopia', 'inspecao remota'] }),
  novo({ code: 'DIM', name: 'Controle Dimensional', norm: '', groupId: 'visual-solda', route: 'dimensional',
    kind: 'tecnica', phase: 1, chips: ['dimensional', 'tolerancia', 'paquimetro', 'medidas'],
    aliases: ['controle dimensional', 'dimensional', 'metrologia'] }),
  novo({ code: 'HOLIDAY', name: 'Holiday Detector', norm: 'NACE SP0188 / ASTM D5162', groupId: 'pintura-revestimento', route: 'holiday',
    kind: 'tecnica', phase: 2, chips: ['holiday', 'descontinuidade', 'revestimento', 'tensao'],
    aliases: ['holiday', 'holiday detector', 'descontinuidade de revestimento'] }),
  novo({ code: 'LT', name: 'Estanqueidade (Leak Testing)', norm: 'ASME V Art. 10', groupId: 'estanqueidade', route: 'estanqueidade',
    kind: 'tecnica', phase: 1, chips: ['estanqueidade', 'vazamento', 'bolhas', 'vacuo'],
    aliases: ['estanqueidade', 'leak testing', 'leak-testing', 'teste de vazamento', 'lt'] }),
  novo({ code: 'AE', name: 'Emissão Acústica', norm: 'ASME V Art. 12', groupId: 'estanqueidade', route: 'emissao-acustica',
    kind: 'tecnica', phase: 3, chips: ['emissao acustica', 'monitoramento', 'sensores'],
    aliases: ['emissao acustica', 'acoustic emission', 'ae'] }),
  novo({ code: 'PMI', name: 'Teste por Pontos e Identificação de Metais (PMI)', norm: 'ASTM E1476 / API RP 578', groupId: 'materiais', route: 'pmi',
    kind: 'tecnica', phase: 1, chips: ['pmi', 'identificacao de metais', 'liga', 'teste por pontos'],
    aliases: ['pmi', 'teste por pontos', 'identificacao de metais', 'xrf'] }),
  novo({ code: 'ESPEC', name: 'Espectrometria', norm: '', groupId: 'materiais', route: 'espectrometria',
    kind: 'tecnica', phase: 2, chips: ['espectrometria', 'composicao quimica', 'liga'],
    aliases: ['espectrometria', 'espectrometro', 'composicao quimica'] }),
  novo({ code: 'REP', name: 'Metalografia / Réplica Metalográfica', norm: 'ASTM E1351', groupId: 'materiais', route: 'replica',
    kind: 'tecnica', phase: 2, chips: ['replica', 'metalografia', 'microestrutura'],
    aliases: ['replica metalografica', 'metalografia', 'rep'] }),
  novo({ code: 'TT', name: 'Tratamento Térmico', norm: '', groupId: 'materiais', route: 'tratamento-termico',
    kind: 'servico', phase: 3, chips: ['tratamento termico', 'termopares', 'ciclo termico', 'alivio de tensoes'],
    aliases: ['tratamento termico', 'ttat', 'alivio de tensoes'] }),
  novo({ code: 'TERMO', name: 'Termografia', norm: 'ISO 18434-1 / ASTM E1934', groupId: 'preditiva', route: 'termografia',
    kind: 'tecnica', phase: 3, chips: ['termografia', 'infravermelho', 'temperatura'],
    aliases: ['termografia', 'infravermelho', 'camera termica'] }),
  novo({ code: 'VIBR', name: 'Vibrações', norm: 'ISO 20816 / ISO 18436-2', groupId: 'preditiva', route: 'vibracoes',
    kind: 'tecnica', phase: 3, chips: ['vibracao', 'espectro', 'rotativos'],
    aliases: ['vibracao', 'vibracoes', 'analise de vibracao'] }),
  novo({ code: 'EQUIP', name: 'Inspeção de Equipamentos', norm: '', groupId: 'ativos', route: 'equipamentos',
    kind: 'inspecao', phase: 2, chips: ['equipamentos', 'inspecao periodica', 'caldeira', 'tanque', 'tubulacao'],
    aliases: ['inspecao de equipamentos', 'equipamentos', 'caldeira', 'tanque', 'tubulacao'] }),
  novo({ code: 'DUTOS', name: 'Dutos Terrestres', norm: '', groupId: 'ativos', route: 'dutos',
    kind: 'inspecao', phase: 3, chips: ['dutos', 'oleoduto', 'gasoduto', 'faixa'],
    aliases: ['dutos terrestres', 'dutos', 'oleoduto', 'gasoduto'] }),
  novo({ code: 'PIG', name: 'PIG', norm: '', groupId: 'ativos', route: 'pig',
    kind: 'inspecao', phase: 3, chips: ['pig', 'pigagem', 'duto'], aliases: ['pig', 'pigagem', 'inspecao com pig'] }),
  novo({ code: 'SUBAQ', name: 'Inspeção Subaquática', norm: '', groupId: 'ativos', route: 'subaquatica',
    kind: 'inspecao', phase: 3, chips: ['subaquatica', 'mergulho', 'ROV', 'EV PM PE USME ACFM'],
    aliases: ['inspecao subaquatica', 'subaquatica', 'rov', 'mergulho'] }),
  novo({ code: 'AIE', name: 'Avaliação da Integridade', norm: '', groupId: 'ativos', route: 'integridade',
    kind: 'inspecao', phase: 3, chips: ['integridade', 'avaliacao', 'vida remanescente'],
    aliases: ['avaliacao da integridade', 'integridade', 'aptidao para o servico'] }),
  novo({ code: 'ATEX', name: 'Atmosferas Explosivas', norm: 'ABNT NBR IEC 60079-17', groupId: 'ativos', route: 'atmosferas-explosivas',
    kind: 'inspecao', phase: 3, chips: ['atex', 'area classificada', 'ex', 'instalacoes eletricas'],
    aliases: ['atmosferas explosivas', 'atex', 'area classificada'] }),
  novo({ code: 'FABRIC', name: 'Inspeção de Fabricação / Diligenciamento', norm: '', groupId: 'servicos', route: 'fabricacao',
    kind: 'servico', phase: 2, chips: ['fabricacao', 'diligenciamento', 'fornecedor', 'fabrica'],
    aliases: ['inspecao de fabricacao', 'diligenciamento', 'inspecao em fabrica'] }),
  novo({ code: 'CORDA', name: 'Acesso por Corda', norm: 'ABNT NBR 15475 / NR-35', groupId: 'servicos', route: 'acesso-por-corda',
    kind: 'servico', phase: 3, chips: ['acesso por corda', 'altura', 'rapel'],
    aliases: ['acesso por corda', 'trabalho em altura', 'rapel'] }),
]

const GROUP_DEFS: Array<{ id: string; name: string }> = [
  { id: 'superficie', name: 'Superfície' },
  { id: 'ultrassom', name: 'Ultrassom' },
  { id: 'radiografico', name: 'Radiográfico' },
  { id: 'visual-solda', name: 'Visual, Solda & Dimensional' },
  { id: 'pintura-revestimento', name: 'Pintura & Revestimento' },
  { id: 'estanqueidade', name: 'Estanqueidade & Integridade' },
  { id: 'materiais', name: 'Materiais em Campo' },
  { id: 'preditiva', name: 'Manutenção Preditiva' },
  { id: 'vasos-pressao', name: 'Vasos de Pressão (NR-13)' },
  { id: 'ativos', name: 'Inspeção de Ativos' },
  { id: 'servicos', name: 'Serviços de Campo' },
]

const NEUTRAL = '#94A3B8'

export const METHOD_GROUPS: MethodGroup[] = GROUP_DEFS.map((g) => ({
  id: g.id,
  name: g.name,
  accentColor: NEUTRAL,
  methods: METHODS_CATALOG.filter((m) => m.groupId === g.id),
}))

export function getEnabledMethods(): MethodCatalogItem[] {
  return METHODS_CATALOG.filter((m) => m.available)
}

export function getMethodsByPhase(phase: 1 | 2 | 3): MethodCatalogItem[] {
  return METHODS_CATALOG.filter((m) => !m.available && m.phase === phase)
}
