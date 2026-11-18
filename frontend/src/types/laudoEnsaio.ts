// Dados técnicos dos laudos: UT e PAUT com formulário próprio, os demais métodos no formulário padrão.
// Valores numéricos ficam como texto: o inspetor digita "4,9" e nada se perde ao reabrir.
import type { ENDMethod } from './inspection'

export interface FotoLaudo {
  anexoId: string
  legenda: string
}

export interface IdentificacaoEnsaio {
  cliente: string
  obra: string
  desenho: string
  itemEnsaiado: string
  material: string
  procedimento: string
  revisaoProcedimento: string
  planoInspecao: string
}

export interface AparelhoEnsaio {
  aparelhoFabricante: string
  aparelhoModelo: string
  aparelhoSerie: string
}

export interface Cabecote {
  id: string
  fabricante: string
  modelo: string
  serie: string
  dimensoes: string
  angulo: string
  frequencia: string
  espessuraPeca: string
  espessuraBloco: string
  ganhoReferencia: string
  ganhoAuxiliar: string
  ganhoCorrigido: string
  ganhoVarredura: string
  superficie: string
}

export type TipoDefeito = '' | 'FP' | 'FF' | 'PO' | 'TL' | 'TT' | 'IE'
export type ResultadoIndicacao = '' | 'A' | 'R'

export interface IndicacaoUt {
  id: string
  identificacao: string
  tipoProvavel: string
  comprimento: string
  profundidade: string
  percursoSonico: string
  distanciaBorda: string
  localizacao: string
  superficie: string
  nivelIndicacao: string
  nivelReferencia: string
  fatorAtenuacao: string
  nivelDescontinuidade: string
  cabecote: string
  soldadorRaiz: string
  soldadorEnchimento: string
  tipoDefeito: TipoDefeito
  resultado: ResultadoIndicacao
}

export interface IndicacaoPaut {
  id: string
  identificacao: string
  posicao: string
  comprimento: string
  profundidade: string
  tipoDefeito: TipoDefeito
  resultado: ResultadoIndicacao
}

export interface DadosUt extends IdentificacaoEnsaio, AparelhoEnsaio {
  esquema: 'ut-solda-v1'
  temperatura: string
  condicaoSuperficie: string
  acoplante: string
  tecnica: string
  blocoPadrao: string
  blocoReferencia: string
  tipoJunta: string
  tratamentoTermico: '' | 'antes' | 'depois' | 'nao_houve'
  cabecotes: Cabecote[]
  indicacoes: IndicacaoUt[]
  recomendacao: string
  sit: string
  rnc: string
  fotos: FotoLaudo[]
}

export interface DadosPaut extends IdentificacaoEnsaio, AparelhoEnsaio {
  esquema: 'paut-v1'
  modo: 'solda' | 'espessura'
  sonda: string
  cunha: string
  ganhoPrimario: string
  ganhoVarredura: string
  ganhoAvaliacao: string
  // Solda
  tipoJunta: '' | 'longitudinal' | 'circunferencial'
  diametroExterno: string
  espessura: string
  indicacoes: IndicacaoPaut[]
  // Espessura
  tubo: string
  espessuraNominal: string
  comprimentoVarredura: string
  espessuraMinima: string
  medicoes: string[]
  fotos: FotoLaudo[]
}

// ── Formulário padrão (os métodos sem formulário detalhado) ──

export interface IndicacaoPadrao {
  id: string
  identificacao: string
  localizacao: string
  tipo: string
  dimensoes: string
  resultado: ResultadoIndicacao
  // Colunas próprias de alguns métodos (ex.: altura no ToFD), ver COLUNAS_INDICACAO
  [coluna: string]: string
}

export interface DadosPadrao extends IdentificacaoEnsaio, AparelhoEnsaio {
  esquema: 'padrao-v1'
  temperatura: string
  condicaoSuperficie: string
  tecnica: string
  indicacoes: IndicacaoPadrao[]
  recomendacao: string
  sit: string
  rnc: string
  fotos: FotoLaudo[]
}

/** Campo técnico próprio de um método. A chave é a mesma já usada em laudos antigos. */
export interface CampoMetodo {
  chave: string
  rotulo: string
  placeholder?: string
  opcoes?: Array<{ valor: string; rotulo: string }>
  numerico?: boolean
}

// Campos repetidos nos métodos de radiografia (RT e CR/DR)
const FONTE_RADIACAO: CampoMetodo[] = [
  { chave: 'fonte', rotulo: 'Fonte', opcoes: [{ valor: 'ir192', rotulo: 'Ir-192' }, { valor: 'se75', rotulo: 'Se-75' }, { valor: 'co60', rotulo: 'Co-60' }, { valor: 'raios_x', rotulo: 'Raios X' }] },
  { chave: 'atividadeTensao', rotulo: 'Atividade (Ci) ou tensão (kV)', placeholder: 'Ex: 30 Ci ou 200 kV' },
  { chave: 'pontoFocal', rotulo: 'Tamanho do ponto focal (mm)', placeholder: 'Ex: 3', numerico: true },
  { chave: 'tempoExposicao', rotulo: 'Tempo de exposição', placeholder: 'Ex: 2,5 min' },
  { chave: 'tecnicaExposicao', rotulo: 'Técnica de exposição', opcoes: [{ valor: 'ps_vs', rotulo: 'Parede simples, vista simples' }, { valor: 'pd_vs', rotulo: 'Parede dupla, vista simples' }, { valor: 'pd_vd', rotulo: 'Parede dupla, vista dupla' }, { valor: 'panoramica', rotulo: 'Panorâmica' }] },
]
const ESPESSURA_RADIOGRAFIA: CampoMetodo = { chave: 'espessuraReforco', rotulo: 'Espessura da peça mais reforço (mm)', placeholder: 'Ex: 12 + 2' }
const IQI: CampoMetodo = { chave: 'iqi', rotulo: 'IQI (tipo e número)', placeholder: 'Ex: fios ASTM 1A' }
const FIO_ESSENCIAL: CampoMetodo = { chave: 'fioEssencial', rotulo: 'Fio ou furo essencial', placeholder: 'Ex: fio 6' }
const PENUMBRA: CampoMetodo = { chave: 'penumbra', rotulo: 'Penumbra geométrica, Ug (mm)', placeholder: 'Ex: 0,5', numerico: true }
const SOFTWARE: CampoMetodo = { chave: 'software', rotulo: 'Software e versão' }
const BLOCO_CALIBRACAO: CampoMetodo = { chave: 'blocoCalibracao', rotulo: 'Bloco ou padrão de calibração (identificação)' }
const REVESTIMENTO: CampoMetodo = { chave: 'espessuraRevestimento', rotulo: 'Espessura do revestimento (µm)', placeholder: 'Ex: 300', numerico: true }
const FREQUENCIA_KHZ: CampoMetodo = { chave: 'frequencia', rotulo: 'Frequência (kHz)', placeholder: 'Ex: 100', numerico: true }
const GANHO: CampoMetodo = { chave: 'ganho', rotulo: 'Ganho (dB)', placeholder: 'Ex: 42', numerico: true }
const ROTACAO_FASE: CampoMetodo = { chave: 'rotacaoFase', rotulo: 'Rotação de fase (°)', placeholder: 'Ex: 180', numerico: true }
const CONFIGURACAO_SONDA: CampoMetodo = { chave: 'configuracaoSonda', rotulo: 'Configuração da sonda', opcoes: [{ valor: 'absoluta', rotulo: 'Absoluta' }, { valor: 'diferencial', rotulo: 'Diferencial' }, { valor: 'reflexao', rotulo: 'Reflexão (emissão e recepção)' }] }
const SOLUCAO_BOLHAS: CampoMetodo = { chave: 'solucaoBolhas', rotulo: 'Solução formadora de bolhas (marca e lote)' }
const PASSO_AQUISICAO: CampoMetodo = { chave: 'passoAquisicao', rotulo: 'Passo de aquisição (mm)', placeholder: 'Ex: 0,5', numerico: true }

export const CAMPOS_POR_METODO: Partial<Record<ENDMethod, CampoMetodo[]>> = {
  VT: [
    { chave: 'modalidade', rotulo: 'Modalidade', opcoes: [{ valor: 'direta', rotulo: 'Direta' }, { valor: 'remota', rotulo: 'Remota (boroscópio ou drone)' }] },
    { chave: 'iluminacao', rotulo: 'Iluminação (lux)', placeholder: 'Ex: 500 lux' },
    { chave: 'distancia', rotulo: 'Distância e ângulo de observação', placeholder: 'Ex: 300 mm / 90°' },
    { chave: 'instrumentos', rotulo: 'Instrumentos auxiliares', placeholder: 'Ex: lupa, espelho, calibre' },
    { chave: 'checklist', rotulo: 'Itens verificados', placeholder: 'Ex: reforço, mordedura, desalinhamento' },
  ],
  PT: [
    { chave: 'tipoPenetrante', rotulo: 'Tipo de penetrante', opcoes: [{ valor: 'visivel', rotulo: 'Visível (colorido)' }, { valor: 'fluorescente', rotulo: 'Fluorescente' }] },
    { chave: 'metodoRemocao', rotulo: 'Método de remoção', opcoes: [{ valor: 'solvente', rotulo: 'Removível com solvente' }, { valor: 'agua', rotulo: 'Lavável com água' }, { valor: 'pos_emulsificavel', rotulo: 'Pós-emulsificável' }] },
    { chave: 'limpezaPrevia', rotulo: 'Limpeza prévia e secagem', placeholder: 'Ex: solvente, 5 min' },
    { chave: 'penetrantBrand', rotulo: 'Penetrante (marca e lote)', placeholder: 'Ex: VP-30, lote 123' },
    { chave: 'cleanerBrand', rotulo: 'Removedor (marca e lote)' },
    { chave: 'developerBrand', rotulo: 'Revelador (marca e lote)', placeholder: 'Ex: D-70, lote 456' },
    { chave: 'dwellTime', rotulo: 'Tempo de penetração', placeholder: 'Ex: 20 min' },
    { chave: 'developerTime', rotulo: 'Tempo de revelação', placeholder: 'Ex: 15 min' },
    { chave: 'lightIntensity', rotulo: 'Iluminação', placeholder: 'Ex: 1250 lux, luz branca' },
    { chave: 'luzUv', rotulo: 'Luz UV-A (µW/cm²)', placeholder: 'Só no fluorescente. Ex: 1200' },
    { chave: 'indications', rotulo: 'Descrição das indicações' },
  ],
  MT: [
    { chave: 'tecnicaMagnetizacao', rotulo: 'Técnica de magnetização', opcoes: [{ valor: 'yoke', rotulo: 'Yoke' }, { valor: 'pontas', rotulo: 'Pontas (prods)' }, { valor: 'bobina', rotulo: 'Bobina' }, { valor: 'condutor_central', rotulo: 'Condutor central' }, { valor: 'contato_direto', rotulo: 'Contato direto' }, { valor: 'ima_permanente', rotulo: 'Ímã permanente' }] },
    { chave: 'tipoCorrente', rotulo: 'Tipo de corrente', opcoes: [{ valor: 'ca', rotulo: 'Alternada (CA)' }, { valor: 'cc', rotulo: 'Contínua (CC)' }, { valor: 'meia_onda', rotulo: 'Retificada de meia onda' }] },
    { chave: 'tipoParticulas', rotulo: 'Partículas', opcoes: [{ valor: 'umida_fluorescente', rotulo: 'Via úmida fluorescente' }, { valor: 'umida_visivel', rotulo: 'Via úmida visível' }, { valor: 'seca', rotulo: 'Via seca' }] },
    { chave: 'particulas', rotulo: 'Partículas (marca e lote)', placeholder: 'Ex: 7HF, lote 123' },
    { chave: 'tintaContraste', rotulo: 'Tinta de contraste (marca e lote)', placeholder: 'Ex: WCP-2, lote 456' },
    { chave: 'concentracao', rotulo: 'Concentração das partículas', placeholder: 'Ex: 0,2 ml em 100 ml' },
    { chave: 'verificacaoCampo', rotulo: 'Verificação do campo', opcoes: [{ valor: 'indicador', rotulo: 'Indicador de campo' }, { valor: 'laminas', rotulo: 'Lâminas (shims)' }, { valor: 'hall', rotulo: 'Medidor Hall' }, { valor: 'levantamento', rotulo: 'Teste de levantamento' }] },
    { chave: 'forcaLevantamento', rotulo: 'Força de levantamento do yoke', placeholder: 'Ex: 4,5 kg em CA' },
    { chave: 'espacamento', rotulo: 'Espaçamento entre polos ou pontas (mm)', placeholder: 'Ex: 150' },
    { chave: 'luzBranca', rotulo: 'Luz branca (lux)', placeholder: 'Ex: 1000' },
    { chave: 'luzUv', rotulo: 'Luz UV-A (µW/cm²)', placeholder: 'Só no fluorescente. Ex: 1200' },
    { chave: 'desmagnetizacao', rotulo: 'Desmagnetização', opcoes: [{ valor: 'feita', rotulo: 'Feita' }, { valor: 'nao_feita', rotulo: 'Não feita' }, { valor: 'nao_exigida', rotulo: 'Não exigida' }] },
  ],
  RT: [
    ...FONTE_RADIACAO,
    { chave: 'distanciaFonteFilme', rotulo: 'Distância fonte-filme (mm)', placeholder: 'Ex: 700', numerico: true },
    ESPESSURA_RADIOGRAFIA,
    { chave: 'filme', rotulo: 'Filme (marca e classe)', placeholder: 'Ex: D7, classe I' },
    { chave: 'filmesPorChassi', rotulo: 'Filmes por chassi', opcoes: [{ valor: '1', rotulo: '1' }, { valor: '2', rotulo: '2' }] },
    { chave: 'ecran', rotulo: 'Écran (tipo e espessura)', placeholder: 'Ex: chumbo 0,027 mm' },
    IQI,
    { chave: 'posicaoIqi', rotulo: 'Posição do IQI', opcoes: [{ valor: 'fonte', rotulo: 'Lado da fonte' }, { valor: 'filme', rotulo: 'Lado do filme' }] },
    FIO_ESSENCIAL,
    { chave: 'faixaDensidade', rotulo: 'Faixa de densidade', placeholder: 'Ex: 2,0 a 4,0' },
    { chave: 'densitometro', rotulo: 'Densitômetro (identificação)' },
    PENUMBRA,
  ],
  CRDR: [
    ...FONTE_RADIACAO,
    { chave: 'distanciaFonteDetector', rotulo: 'Distância fonte-detector (mm)', placeholder: 'Ex: 700', numerico: true },
    ESPESSURA_RADIOGRAFIA,
    { chave: 'detector', rotulo: 'Detector', opcoes: [{ valor: 'cr', rotulo: 'Placa de fósforo (CR)' }, { valor: 'dr', rotulo: 'Painel digital (DR)' }] },
    { chave: 'detectorModelo', rotulo: 'Detector (marca, modelo e série)' },
    { chave: 'leitor', rotulo: 'Leitor da placa (marca e modelo)', placeholder: 'Só no CR' },
    { chave: 'pixel', rotulo: 'Tamanho do pixel (µm)', placeholder: 'Ex: 100', numerico: true },
    { chave: 'ecran', rotulo: 'Écran ou filtro', placeholder: 'Ex: cobre 0,1 mm' },
    IQI,
    { chave: 'posicaoIqi', rotulo: 'Posição do IQI', opcoes: [{ valor: 'fonte', rotulo: 'Lado da fonte' }, { valor: 'detector', rotulo: 'Lado do detector' }] },
    FIO_ESSENCIAL,
    { chave: 'duploFio', rotulo: 'IQI de duplo fio (par resolvido)', placeholder: 'Ex: D10' },
    { chave: 'snr', rotulo: 'Relação sinal-ruído (SNRn)', placeholder: 'Ex: 100', numerico: true },
    SOFTWARE,
    PENUMBRA,
  ],
  TOFD: [
    { chave: 'sondas', rotulo: 'Sondas (marca, frequência e tamanho)', placeholder: 'Ex: 5 MHz, 6 mm' },
    { chave: 'anguloSapatas', rotulo: 'Ângulo das sapatas (°)', placeholder: 'Ex: 60', numerico: true },
    { chave: 'pcs', rotulo: 'Distância entre sondas, PCS (mm)', placeholder: 'Ex: 54', numerico: true },
    { chave: 'profundidadeFoco', rotulo: 'Profundidade de foco', placeholder: 'Ex: 2/3 da espessura' },
    { chave: 'paresZonas', rotulo: 'Número de pares e zonas', placeholder: 'Ex: 1 par, 1 zona' },
    { chave: 'tipoVarredura', rotulo: 'Tipo de varredura', opcoes: [{ valor: 'nao_paralela', rotulo: 'Não paralela' }, { valor: 'paralela', rotulo: 'Paralela' }] },
    { chave: 'passoAquisicao', rotulo: 'Passo de aquisição (mm)', placeholder: 'Ex: 0,5', numerico: true },
    { chave: 'acoplante', rotulo: 'Acoplante' },
    { chave: 'blocoCalibracao', rotulo: 'Bloco de calibração (identificação)' },
    { chave: 'ganho', rotulo: 'Ganho (dB)', placeholder: 'Ex: 42', numerico: true },
    { chave: 'espessura', rotulo: 'Espessura (mm)', placeholder: 'Ex: 25', numerico: true },
    SOFTWARE,
  ],
  ET: [
    { chave: 'aplicacao', rotulo: 'Aplicação', opcoes: [{ valor: 'solda', rotulo: 'Solda' }, { valor: 'superficie', rotulo: 'Superfície' }, { valor: 'tubos', rotulo: 'Tubos de trocador (sonda interna)' }, { valor: 'camada', rotulo: 'Medição de camada' }] },
    { chave: 'sonda', rotulo: 'Sonda (tipo, marca e modelo)', placeholder: 'Ex: sonda de lápis, 100 kHz' },
    CONFIGURACAO_SONDA,
    FREQUENCIA_KHZ,
    GANHO,
    ROTACAO_FASE,
    BLOCO_CALIBRACAO,
    REVESTIMENTO,
  ],
  ECA: [
    { chave: 'sonda', rotulo: 'Sonda array (marca, modelo e elementos)', placeholder: 'Ex: 32 elementos' },
    CONFIGURACAO_SONDA,
    FREQUENCIA_KHZ,
    GANHO,
    ROTACAO_FASE,
    { chave: 'cobertura', rotulo: 'Cobertura por passada (mm)', placeholder: 'Ex: 50', numerico: true },
    PASSO_AQUISICAO,
    BLOCO_CALIBRACAO,
    REVESTIMENTO,
    SOFTWARE,
  ],
  LT: [
    { chave: 'tecnicaEstanqueidade', rotulo: 'Técnica', opcoes: [{ valor: 'bolhas', rotulo: 'Formação de bolhas com pressão positiva' }, { valor: 'variacao_pressao', rotulo: 'Variação de pressão' }, { valor: 'helio', rotulo: 'Detector de hélio' }, { valor: 'halogenio', rotulo: 'Detector de halogênio' }] },
    { chave: 'fluidoTeste', rotulo: 'Fluido de teste', placeholder: 'Ex: ar comprimido, nitrogênio' },
    { chave: 'pressaoTeste', rotulo: 'Pressão de teste', placeholder: 'Ex: 1,5 kgf/cm²' },
    { chave: 'tempoPermanencia', rotulo: 'Tempo de permanência', placeholder: 'Ex: 15 min' },
    { chave: 'manometro', rotulo: 'Manômetro (identificação, faixa e calibração)', placeholder: 'Ex: MN-03, 0 a 4 kgf/cm²' },
    SOLUCAO_BOLHAS,
    { chave: 'vazamentoPadrao', rotulo: 'Vazamento padrão (calibração)', placeholder: 'Só nos detectores' },
    { chave: 'taxaVazamento', rotulo: 'Taxa de vazamento medida', placeholder: 'Ex: 1 × 10⁻⁶ mbar·L/s' },
  ],
  LT_VACUO: [
    { chave: 'caixaVacuo', rotulo: 'Caixa de vácuo (identificação e tamanho)', placeholder: 'Ex: CV-02, 750 × 150 mm' },
    { chave: 'vacuo', rotulo: 'Vácuo aplicado', placeholder: 'Ex: 15 kPa abaixo da atmosfera' },
    { chave: 'vacuometro', rotulo: 'Vacuômetro (identificação e calibração)' },
    { chave: 'tempoPosicao', rotulo: 'Tempo por posição (s)', placeholder: 'Ex: 10', numerico: true },
    { chave: 'sobreposicao', rotulo: 'Sobreposição entre posições (mm)', placeholder: 'Ex: 50', numerico: true },
    SOLUCAO_BOLHAS,
    { chave: 'iluminacao', rotulo: 'Iluminação (lux)', placeholder: 'Ex: 1000', numerico: true },
  ],
  EA: [
    { chave: 'sistema', rotulo: 'Sistema (marca, modelo e canais)', placeholder: 'Ex: 16 canais' },
    { chave: 'sensores', rotulo: 'Sensores (marca, modelo e frequência)', placeholder: 'Ex: R15, 150 kHz' },
    { chave: 'numeroSensores', rotulo: 'Número de sensores', placeholder: 'Ex: 12', numerico: true },
    { chave: 'ganhoPreAmp', rotulo: 'Ganho do pré-amplificador (dB)', placeholder: 'Ex: 40', numerico: true },
    { chave: 'limiar', rotulo: 'Limiar de detecção (dB)', placeholder: 'Ex: 45', numerico: true },
    { chave: 'verificacaoSensores', rotulo: 'Verificação dos sensores', opcoes: [{ valor: 'grafite', rotulo: 'Quebra de grafite' }, { valor: 'pulsador', rotulo: 'Pulsador eletrônico' }] },
    { chave: 'fluidoPressurizacao', rotulo: 'Fluido de pressurização', placeholder: 'Ex: água' },
    { chave: 'pressaoPatamares', rotulo: 'Pressão máxima e patamares', placeholder: 'Ex: 110% da PMTA, 3 patamares de 10 min' },
    SOFTWARE,
  ],
  IRT: [
    { chave: 'camera', rotulo: 'Câmera (marca, modelo e série)' },
    { chave: 'resolucao', rotulo: 'Resolução do detector', placeholder: 'Ex: 320 × 240' },
    { chave: 'faixaCamera', rotulo: 'Faixa de temperatura da câmera', placeholder: 'Ex: -20 a 650 °C' },
    { chave: 'emissividade', rotulo: 'Emissividade', placeholder: 'Ex: 0,95', numerico: true },
    { chave: 'temperaturaRefletida', rotulo: 'Temperatura refletida (°C)', placeholder: 'Ex: 25', numerico: true },
    { chave: 'temperaturaAmbiente', rotulo: 'Temperatura ambiente (°C)', placeholder: 'Ex: 28', numerico: true },
    { chave: 'umidade', rotulo: 'Umidade relativa (%)', placeholder: 'Ex: 60', numerico: true },
    { chave: 'distanciaObjeto', rotulo: 'Distância ao objeto (m)', placeholder: 'Ex: 2', numerico: true },
    { chave: 'vento', rotulo: 'Velocidade do vento (m/s)', placeholder: 'Ex: 1', numerico: true },
    { chave: 'carga', rotulo: 'Carga do equipamento (%)', placeholder: 'Na inspeção elétrica', numerico: true },
    SOFTWARE,
  ],
  ACFM: [
    { chave: 'sonda', rotulo: 'Sonda (tipo, marca e modelo)', placeholder: 'Ex: sonda padrão de solda' },
    { chave: 'frequencia', rotulo: 'Frequência (kHz)', placeholder: 'Ex: 5', numerico: true },
    BLOCO_CALIBRACAO,
    REVESTIMENTO,
    SOFTWARE,
  ],
  TFM: [
    { chave: 'sonda', rotulo: 'Sonda (marca, frequência e elementos)', placeholder: 'Ex: 5 MHz, 64 elementos' },
    { chave: 'sapata', rotulo: 'Sapata (modelo e ângulo)', placeholder: 'Ex: SA31, 36°' },
    { chave: 'abertura', rotulo: 'Abertura usada (elementos)', placeholder: 'Ex: 64', numerico: true },
    { chave: 'modoPropagacao', rotulo: 'Modos de propagação', placeholder: 'Ex: TT, TT-T, TT-TT' },
    { chave: 'zonaReconstrucao', rotulo: 'Zona de reconstrução (mm)', placeholder: 'Ex: 60 × 30' },
    { chave: 'pixel', rotulo: 'Tamanho do pixel (mm)', placeholder: 'Ex: 0,1', numerico: true },
    { chave: 'velocidadeSom', rotulo: 'Velocidade do som usada (m/s)', placeholder: 'Ex: 3240' },
    BLOCO_CALIBRACAO,
    GANHO,
    PASSO_AQUISICAO,
    { chave: 'acoplante', rotulo: 'Acoplante' },
    SOFTWARE,
  ],
}

/** Colunas variáveis da tabela de indicações. Sem configuração, valem Localização e Dimensões. */
const COLUNAS_PADRAO: CampoMetodo[] = [
  { chave: 'localizacao', rotulo: 'Localização' },
  { chave: 'dimensoes', rotulo: 'Dimensões (mm)' },
]
// ToFD e TFM dimensionam a altura da indicação
const DIMENSIONAMENTO_ALTURA: CampoMetodo[] = [
  { chave: 'posicaoInicial', rotulo: 'Posição inicial (mm)', numerico: true },
  { chave: 'comprimento', rotulo: 'Comprimento (mm)', numerico: true },
  { chave: 'profundidade', rotulo: 'Profundidade (mm)', numerico: true },
  { chave: 'altura', rotulo: 'Altura (mm)', numerico: true },
]
const COLUNAS_INDICACAO: Partial<Record<ENDMethod, CampoMetodo[]>> = {
  RT: [
    { chave: 'localizacao', rotulo: 'Localização (filme e posição)', placeholder: 'Ex: filme 2, 0 a 30 cm' },
    { chave: 'dimensoes', rotulo: 'Dimensões (mm)' },
  ],
  TOFD: DIMENSIONAMENTO_ALTURA,
  TFM: DIMENSIONAMENTO_ALTURA,
  EA: [
    { chave: 'localizacao', rotulo: 'Localização da fonte' },
    { chave: 'classe', rotulo: 'Classificação da fonte', placeholder: 'Ex: classe B' },
  ],
  IRT: [
    { chave: 'localizacao', rotulo: 'Localização' },
    { chave: 'temperaturaMaxima', rotulo: 'Temperatura máxima (°C)', numerico: true },
    { chave: 'temperaturaReferencia', rotulo: 'Temperatura de referência (°C)', numerico: true },
    { chave: 'deltaT', rotulo: 'Diferença, ΔT (°C)', numerico: true },
  ],
  ACFM: [
    { chave: 'localizacao', rotulo: 'Localização' },
    { chave: 'comprimento', rotulo: 'Comprimento (mm)', numerico: true },
    { chave: 'profundidade', rotulo: 'Profundidade estimada (mm)', numerico: true },
  ],
}
export const colunasIndicacao = (metodo: ENDMethod): CampoMetodo[] => COLUNAS_INDICACAO[metodo] ?? COLUNAS_PADRAO

const DESCONTINUIDADES_SOLDA = ['Porosidade', 'Inclusão de escória', 'Falta de fusão', 'Falta de penetração', 'Trinca', 'Mordedura', 'Concavidade de raiz', 'Penetração excessiva']

/** Sugestões do campo "Tipo de indicação"; o inspetor pode digitar outro. */
export const TIPOS_INDICACAO: Partial<Record<ENDMethod, string[]>> = {
  MT: ['Linear', 'Arredondada'],
  PT: ['Linear', 'Arredondada'],
  VT: ['Mordedura', 'Reforço excessivo', 'Concavidade', 'Sobreposição', 'Falta de fusão', 'Porosidade', 'Trinca', 'Respingos', 'Desalinhamento'],
  RT: DESCONTINUIDADES_SOLDA,
  CRDR: DESCONTINUIDADES_SOLDA,
  TOFD: DESCONTINUIDADES_SOLDA,
  TFM: DESCONTINUIDADES_SOLDA,
  ET: ['Trinca', 'Corrosão', 'Pite', 'Perda de espessura', 'Desgaste'],
  ECA: ['Trinca', 'Corrosão', 'Pite', 'Perda de espessura', 'Desgaste'],
  ACFM: ['Trinca no pé da solda', 'Trinca longitudinal', 'Trinca transversal'],
  LT: ['Vazamento contínuo', 'Vazamento intermitente'],
  LT_VACUO: ['Vazamento contínuo', 'Vazamento intermitente'],
  EA: ['Fonte ativa', 'Fonte crítica', 'Ruído'],
  IRT: ['Ponto quente', 'Conexão frouxa', 'Sobrecarga', 'Isolamento danificado', 'Obstrução'],
}

export const TIPOS_DEFEITO: Array<{ valor: TipoDefeito; rotulo: string }> = [
  { valor: 'FP', rotulo: 'FP, falta de penetração' },
  { valor: 'FF', rotulo: 'FF, falta de fusão' },
  { valor: 'PO', rotulo: 'PO, poro ou porosidade' },
  { valor: 'TL', rotulo: 'TL, trinca longitudinal' },
  { valor: 'TT', rotulo: 'TT, trinca transversal' },
  { valor: 'IE', rotulo: 'IE, inclusão de escória' },
]

/** Converte texto digitado ("4,9") em número; vazio ou inválido vira null. */
export function paraNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

export interface ResumoMedicoes {
  total: number
  minimo: number | null
  maximo: number | null
  media: number | null
  abaixoDoLimite: number[]
}

/** Resumo das medições de espessura. abaixoDoLimite traz os números dos pontos, a partir de 1. */
export function resumirMedicoes(medicoes: string[], limite: string): ResumoMedicoes {
  const lim = paraNumero(limite)
  const validos: number[] = []
  const abaixoDoLimite: number[] = []
  medicoes.forEach((m, i) => {
    const n = paraNumero(m)
    if (n === null) return
    validos.push(n)
    if (lim !== null && n < lim) abaixoDoLimite.push(i + 1)
  })
  if (validos.length === 0) return { total: 0, minimo: null, maximo: null, media: null, abaixoDoLimite }
  const soma = validos.reduce((a, b) => a + b, 0)
  return {
    total: validos.length,
    minimo: Math.min(...validos),
    maximo: Math.max(...validos),
    media: soma / validos.length,
    abaixoDoLimite,
  }
}

/** Separa uma lista colada ("4,9 4,8" ou "1 - 4,9mm") nos valores medidos. */
export function separarMedicoes(texto: string): string[] {
  return texto
    .split(/[\n;\t]+|\s{2,}|\s(?=\d)/)
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => {
      const comIndice = parte.match(/^\d+\s*-\s*(.+)$/)
      return (comIndice ? comIndice[1] : parte).replace(/mm$/i, '').trim()
    })
    .filter((valor) => paraNumero(valor) !== null)
}
