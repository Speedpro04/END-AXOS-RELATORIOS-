export type MethodCode = 'LP' | 'PM' | 'US' | 'ME' | 'EVS' | 'PINT' | 'NR13_VASO' | 'RADIO'

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
}

export interface MethodGroup {
  id: string
  name: string
  accentColor: string
  methods: MethodCatalogItem[]
}

export const METHODS_CATALOG: MethodCatalogItem[] = [
  // Grupo: Superfície
  {
    id: 'LP',
    code: 'LP',
    name: 'Líquido Penetrante',
    norm: 'ASME V Art. 6 / Petrobras N-1596',
    chips: ['ensaio', 'superficial', 'penetrante', 'indicações'],
    aliases: ['liquido penetrante', 'penetrante', 'lp'],
    groupId: 'superficie',
    route: 'lp',
    available: true,
  },
  {
    id: 'PM',
    code: 'PM',
    name: 'Partícula Magnética',
    norm: 'Petrobras N-1598 / ASME VIII Ap. 6',
    chips: ['subsuperficial', 'ferromagnetico', 'yoke', 'fluorescente'],
    aliases: ['particula magnetica', 'pm'],
    groupId: 'superficie',
    route: 'pm',
    available: true,
  },
  // Grupo: Ultrassom
  {
    id: 'US',
    code: 'US',
    name: 'Ultrassom Industrial',
    norm: 'ASME V Art. 4 / Petrobras N-1594',
    chips: ['volumetrico', 'juntas', 'feixe', 'angular'],
    aliases: ['ultrassom industrial', 'us'],
    groupId: 'ultrassom',
    route: 'us',
    available: true,
  },
  {
    id: 'ME',
    code: 'ME',
    name: 'Medição de Espessura',
    norm: 'Petrobras N-1594 / ASME V Art. 5',
    chips: ['espessura', 'malha', 'corrosao', 'vida remanescente'],
    aliases: ['medicao espessura', 'me'],
    groupId: 'ultrassom',
    route: 'me',
    available: true,
  },
  // Grupo: Radiográfico (sem páginas ainda)
  {
    id: 'RADIO',
    code: 'RADIO',
    name: 'Radiografia Industrial',
    norm: '',
    chips: ['radiografia', 'industrial'],
    aliases: ['radiografia', 'radio'],
    groupId: 'radiografico',
    route: 'radio',
    available: false,
  },
  // Grupo: Visual & Solda
  {
    id: 'EVS',
    code: 'EVS',
    name: 'Inspeção Visual de Solda',
    norm: 'AWS D1.1 / ASME B31.3',
    chips: ['visual', 'solda', 'checklist', 'EPS WPS'],
    aliases: ['inspecao visual de solda', 'evs'],
    groupId: 'visual-solda',
    route: 'evs',
    available: true,
  },
  // Grupo: Pintura & Revestimento
  {
    id: 'PINT',
    code: 'PINT',
    name: 'Pintura & Aderência',
    norm: 'Petrobras N-13 / ISO 8501',
    chips: ['pintura', 'aderencia', 'rugosidade', 'eps'],
    aliases: ['pintura aderencia', 'pint'],
    groupId: 'pintura-revestimento',
    route: 'pintura',
    available: true,
  },
  // Grupo: Vasos de Pressão (NR-13)
  {
    id: 'NR13_VASO',
    code: 'NR13_VASO',
    name: 'Vaso de Pressão (NR-13)',
    norm: 'NR-13 MTE / ASME Sec. VIII',
    chips: ['vaso', 'pressao', 'nr13', 'pmta'],
    aliases: ['vaso de pressao', 'nr13'],
    groupId: 'vasos-pressao',
    route: 'nr13',
    available: true,
  },
]

export const METHOD_GROUPS: MethodGroup[] = [
  {
    id: 'superficie',
    name: 'Superfície',
    accentColor: '#059669',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'superficie'),
  },
  {
    id: 'ultrassom',
    name: 'Ultrassom',
    accentColor: '#0891b2',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'ultrassom'),
  },
  {
    id: 'radiografico',
    name: 'Radiográfico',
    accentColor: '#6b7280',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'radiografico'),
  },
  {
    id: 'visual-solda',
    name: 'Visual & Solda',
    accentColor: '#7c3aed',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'visual-solda'),
  },
  {
    id: 'pintura-revestimento',
    name: 'Pintura & Revestimento',
    accentColor: '#ea580c',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'pintura-revestimento'),
  },
  {
    id: 'vasos-pressao',
    name: 'Vasos de Pressão (NR-13)',
    accentColor: '#d97706',
    methods: METHODS_CATALOG.filter((m) => m.groupId === 'vasos-pressao'),
  },
]

export function getEnabledMethods(tenant?: { reportPrefix?: string }): MethodCatalogItem[] {
  return METHODS_CATALOG.filter((m) => m.available)
}
