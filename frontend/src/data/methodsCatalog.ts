export type MethodCode =
  | 'VT' | 'PT' | 'MT' | 'UT' | 'RT' | 'ET' | 'LT' | 'LT_VACUO'
  | 'PAUT' | 'TOFD' | 'CRDR' | 'ECA' | 'EA' | 'IRT' | 'ACFM' | 'TFM'

export interface MethodCatalogItem {
  id: string
  code: MethodCode
  name: string
  norm: string
  chips: string[]
  aliases: string[]
  groupId: 'convencional' | 'avancado'
  route: string
  available: boolean
  count?: number
}

export interface MethodGroup {
  id: string
  name: string
  accentColor: string
  methods: MethodCatalogItem[]
}

export const METHODS_CATALOG: MethodCatalogItem[] = [
  // ── Convencionais ──
  {
    id: 'VT',
    code: 'VT',
    name: 'Ensaio Visual',
    norm: 'ASME V Art. 9',
    chips: ['visual', 'checklist', 'superficie'],
    aliases: ['ensaio visual', 'visual', 'vt'],
    groupId: 'convencional',
    route: 'vt',
    available: true,
  },
  {
    id: 'PT',
    code: 'PT',
    name: 'Líquidos Penetrantes',
    norm: 'ASME V Art. 6 / Petrobras N-1596',
    chips: ['ensaio', 'superficial', 'penetrante', 'indicações'],
    aliases: ['liquidos penetrantes', 'penetrante', 'pt'],
    groupId: 'convencional',
    route: 'pt',
    available: true,
  },
  {
    id: 'MT',
    code: 'MT',
    name: 'Partículas Magnéticas',
    norm: 'Petrobras N-1598 / ASME VIII Ap. 6',
    chips: ['subsuperficial', 'ferromagnetico', 'yoke', 'fluorescente'],
    aliases: ['particulas magneticas', 'mt'],
    groupId: 'convencional',
    route: 'mt',
    available: true,
  },
  {
    id: 'UT',
    code: 'UT',
    name: 'Ultrassom Convencional',
    norm: 'ASME V Art. 4 / Petrobras N-1594',
    chips: ['volumetrico', 'juntas', 'feixe', 'angular'],
    aliases: ['ultrassom convencional', 'ut'],
    groupId: 'convencional',
    route: 'ut',
    available: true,
  },
  {
    id: 'RT',
    code: 'RT',
    name: 'Radiografia Industrial',
    norm: 'ASME V Art. 2 / 3',
    chips: ['radiografia', 'industrial'],
    aliases: ['radiografia industrial', 'rt'],
    groupId: 'convencional',
    route: 'rt',
    available: true,
  },
  {
    id: 'ET',
    code: 'ET',
    name: 'Correntes Parasitas Convencional',
    norm: 'ASME V Art. 7',
    chips: ['correntes parasitas', 'eletromagnetico'],
    aliases: ['correntes parasitas', 'et'],
    groupId: 'convencional',
    route: 'et',
    available: true,
  },
  {
    id: 'LT',
    code: 'LT',
    name: 'Ensaio de Estanqueidade',
    norm: 'ASME V Art. 10',
    chips: ['estanqueidade', 'vazamento', 'bolhas'],
    aliases: ['estanqueidade', 'leak testing', 'lt'],
    groupId: 'convencional',
    route: 'lt',
    available: true,
  },
  {
    id: 'LT_VACUO',
    code: 'LT_VACUO',
    name: 'Estanqueidade por Caixa de Vácuo',
    norm: 'ASME V Art. 10',
    chips: ['estanqueidade', 'vacuo', 'bolha por vacuo'],
    aliases: ['caixa de vacuo', 'bolha por vacuo', 'lt vacuo'],
    groupId: 'convencional',
    route: 'lt-vacuo',
    available: true,
  },
  // ── Avançados e especiais ──
  {
    id: 'PAUT',
    code: 'PAUT',
    name: 'Ultrassom Phased Array',
    norm: 'ASME V Art. 4 / ISO 13588',
    chips: ['phased array', 'paut', 'varredura eletronica'],
    aliases: ['phased array', 'paut', 'ultrassom avancado'],
    groupId: 'avancado',
    route: 'paut',
    available: false,
  },
  {
    id: 'TOFD',
    code: 'TOFD',
    name: 'ToFD',
    norm: 'ASME V Art. 4',
    chips: ['tofd', 'time of flight diffraction', 'ultrassom avancado'],
    aliases: ['tofd', 'time of flight diffraction'],
    groupId: 'avancado',
    route: 'tofd',
    available: false,
  },
  {
    id: 'CRDR',
    code: 'CRDR',
    name: 'Radiografia Computadorizada / Digital',
    norm: 'ASTM E1742 / ISO 17636-2',
    chips: ['radiografia digital', 'cr', 'dr'],
    aliases: ['radiografia computadorizada', 'radiografia digital', 'cr dr'],
    groupId: 'avancado',
    route: 'crdr',
    available: false,
  },
  {
    id: 'ECA',
    code: 'ECA',
    name: 'Eddy Current Array',
    norm: 'ASME V Art. 8 / ISO 15548',
    chips: ['eca', 'array de correntes parasitas', 'mapeamento'],
    aliases: ['eddy current array', 'eca'],
    groupId: 'avancado',
    route: 'eca',
    available: false,
  },
  {
    id: 'EA',
    code: 'EA',
    name: 'Emissão Acústica',
    norm: 'ASME V Art. 12',
    chips: ['emissao acustica', 'monitoramento', 'sensores'],
    aliases: ['emissao acustica', 'ea'],
    groupId: 'avancado',
    route: 'ea',
    available: false,
  },
  {
    id: 'IRT',
    code: 'IRT',
    name: 'Termografia Infravermelha',
    norm: 'ISO 18434-1 / ASTM E1934',
    chips: ['termografia', 'infravermelho', 'temperatura'],
    aliases: ['termografia', 'infravermelha', 'irt'],
    groupId: 'avancado',
    route: 'irt',
    available: false,
  },
  {
    id: 'ACFM',
    code: 'ACFM',
    name: 'ACFM',
    norm: '',
    chips: ['acfm', 'campo alternado', 'detecção de trinca'],
    aliases: ['acfm', 'alternating current field measurement'],
    groupId: 'avancado',
    route: 'acfm',
    available: false,
  },
  {
    id: 'TFM',
    code: 'TFM',
    name: 'TFM / FMC',
    norm: 'ISO 18563-3',
    chips: ['tfm', 'fmc', 'foco total'],
    aliases: ['tfm', 'fmc', 'total focusing method'],
    groupId: 'avancado',
    route: 'tfm',
    available: false,
  },
]

export const METHOD_GROUPS: MethodGroup[] = [
  {
    id: 'convencional',
    name: 'Convencional',
    accentColor: '#2FB8D6',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'convencional'),
  },
  {
    id: 'avancado',
    name: 'Avançado e especial',
    accentColor: '#6B7280',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'avancado'),
  },
]

export function getEnabledMethods(tenant?: { reportPrefix?: string }): MethodCatalogItem[] {
  return METHODS_CATALOG.filter((m) => m.available)
}
