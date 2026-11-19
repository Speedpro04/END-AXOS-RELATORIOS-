// Gera as páginas públicas dos métodos em landing/laudos/ (uma por método e o índice /laudos/).
// Os campos vêm do formulário do app (laudoEnsaio.ts), para a página prometer só o que o laudo registra.
// Rode depois de mudar textos-metodos.mjs, CAMPOS_POR_METODO, colunasIndicacao ou TIPOS_INDICACAO:
//   npm run gerar:paginas-metodos
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const campos = await import('../src/types/laudoEnsaio.ts')
const { METODOS, GRUPOS } = await import('./textos-metodos.mjs')

const SITE = 'https://axosrelatorios.com'
const DEMO = 'mailto:suporte@axosrelatorios.com?subject=Demonstra%C3%A7%C3%A3o%20AXOS%20Relat%C3%B3rios'
const PORCODIGO = Object.fromEntries(METODOS.map((m) => [m.codigo, m]))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')
// Só a primeira palavra comum vira minúscula: "Raios X" → "raios X"; siglas e isótopos ("IQI", "Ir-192") ficam como estão
const minuscula = (s) => (/^[A-ZÀ-Ý][a-zà-ÿ]+(?:-[a-zà-ÿ]+)*(?=[\s,()]|$)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)
const semParenteses = (s) => s.replace(/\s*\([^)]*\)/g, '')
// Itens que já têm vírgula ("parede simples, vista simples") são separados por ponto e vírgula
const lista = (itens, conjuncao = 'ou') =>
  itens.length < 2
    ? itens.join('')
    : `${itens.slice(0, -1).join(itens.some((i) => i.includes(',')) ? '; ' : ', ')} ${conjuncao} ${itens[itens.length - 1]}`
const url = (m) => `${SITE}/laudos/${m.slug}/`
// "Laudo de líquidos penetrantes (PT)" → "líquidos penetrantes"
const chamada = (m) => m.h1.replace(/^Laudo de /, '').replace(/\s*\([^)]*\)$/, '')

function rotuloComOpcoes(c) {
  if (!c.opcoes?.length) return c.rotulo
  return `${c.rotulo}: ${minuscula(lista(c.opcoes.map((o) => minuscula(o.rotulo))))}`
}

/** O que o laudo do método registra, separado nos mesmos blocos do formulário do app. */
function blocos(m) {
  const p = m.proprios
  const condicoes = p
    ? p.condicoes
    : ['Temperatura da superfície (°C)', 'Condição da superfície', 'Técnica', ...(campos.CAMPOS_POR_METODO[m.codigo] ?? []).map(rotuloComOpcoes)]
  const sugestoes = campos.TIPOS_INDICACAO[m.codigo] ?? []
  const indicacoes = p
    ? p.indicacoes
    : [
        'Peça ou junta',
        ...campos.colunasIndicacao(m.codigo).map((c) => c.rotulo),
        sugestoes.length ? `Tipo de indicação, com sugestões: ${minuscula(lista(sugestoes.map(minuscula)))}` : 'Tipo de indicação',
        'Resultado: aprovada ou reprovada',
      ]
  const conclusao = [
    'Laudo aprovado ou reprovado',
    'Parecer técnico e observações',
    ...(p?.semRecomendacao ? [] : ['Recomendação de ensaio complementar', 'Número da SIT e da RNC, quando houver']),
    'Ligação com a medição da obra',
  ]
  return [
    { titulo: `Condições do ensaio de ${m.sigla}`, itens: condicoes, largo: true },
    ...(m.codigo === 'PAUT' ? [] : [{ titulo: 'Aparelho', itens: ['Fabricante', 'Modelo', 'Número de série'] }]),
    ...(p?.extras ?? []),
    { titulo: 'Tabela de indicações', itens: indicacoes, largo: indicacoes.length > 6 },
    { titulo: 'Identificação', itens: ['Cliente e obra ou fabricante', 'Equipamento ou tubulação e item ensaiado', 'Local e data do ensaio', 'Desenho de referência e material', 'Procedimento e revisão', 'Norma de referência e critério de aceitação', 'Plano de inspeção e teste'] },
    { titulo: 'Fotos e croqui', itens: ['Fotos e telas do aparelho, cada uma com legenda', 'Croqui ou esboço desenhado na própria tela', ...(m.codigo === 'UT' ? ['Croqui da junta com as indicações marcadas'] : [])] },
    { titulo: 'Responsável técnico', itens: ['Inspetor', `Qualificação SNQC em ${m.sigla} usada no laudo, escolhida entre as do próprio inspetor`, 'Responsável técnico da empresa'] },
    { titulo: 'Conclusão', itens: conclusao },
  ]
}

function perguntas(m) {
  const condicoes = m.proprios
    ? m.proprios.resumoFaq
    : `as condições do ensaio, como ${lista((campos.CAMPOS_POR_METODO[m.codigo] ?? []).slice(0, 2).map((c) => minuscula(semParenteses(c.rotulo))), 'e')}`
  return [
    {
      p: `O que o laudo de ${chamada(m)} precisa registrar?`,
      r: `Quem define é o procedimento da sua empresa e o contrato. No AXOS Relatórios, o laudo de ${m.sigla} reúne a identificação da peça e do procedimento, ${condicoes}, a tabela de indicações, as fotos, o croqui e a conclusão.`,
    },
    {
      p: `Dá para fazer o laudo de ${chamada(m)} sem internet?`,
      r: 'Sim. O inspetor preenche o laudo no notebook, no tablet ou no celular mesmo sem sinal. Os dados e as fotos ficam guardados no aparelho e sobem para o servidor quando a conexão volta.',
    },
    {
      p: `O laudo de ${m.sigla} pode ter fotos e croqui?`,
      r: 'Sim. Cada laudo aceita fotos e telas do aparelho, com legenda, e um croqui ou esboço desenhado na própria tela.',
    },
    {
      p: `Qual norma usar no laudo de ${chamada(m)}?`,
      r: 'A norma e o critério de aceitação vêm do contrato e do procedimento da sua empresa. O laudo tem campos para o procedimento e a revisão, a norma de referência, o critério de aceitação e o plano de inspeção e teste.',
    },
  ]
}

const ESTILO = `
    :root {
      color-scheme: dark;
      --bg: #0B0F14; --surface: #121821; --surface-muted: #1A2230; --border: #263042;
      --text: #E8ECF2; --text-muted: #9AA6B8; --accent: #2FB8D6; --accent-hover: #27A3BF; --accent-text: #2FB8D6; --accent-soft: #10303A;
      --radius: 5px; --max: 1140px;
      --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px; --s-12: 48px;
      --section-gap: 80px; --font: Arial, Helvetica, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 400 16px/1.55 var(--font); -webkit-font-smoothing: antialiased; }
    img { display: block; max-width: 100%; height: auto; }
    a { color: var(--accent-text); }
    h1, h2, h3, p, ul, ol { margin: 0; padding: 0; }
    ul, ol { list-style: none; }
    h1, h2, h3 { font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; }
    h1 { font-size: clamp(30px, 4.2vw, 46px); line-height: 1.12; }
    h2 { font-size: clamp(24px, 2.8vw, 32px); line-height: 1.2; }
    h3 { font-size: 18px; line-height: 1.35; }
    :focus-visible { outline: 3px solid var(--accent-text); outline-offset: 2px; border-radius: var(--radius); }
    .container { width: 100%; max-width: var(--max); margin: 0 auto; padding: 0 var(--s-8); }
    .section { padding: var(--section-gap) 0; border-top: 1px solid var(--border); }
    .section-head { max-width: 760px; margin-bottom: var(--s-8); }
    .section-head p { margin-top: var(--s-4); color: var(--text-muted); font-size: 18px; }
    .skip { position: absolute; left: var(--s-4); top: -64px; z-index: 30; padding: var(--s-2) var(--s-4); background: var(--surface); border-radius: var(--radius); }
    .skip:focus { top: var(--s-2); }
    .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 var(--s-6); border: 1px solid transparent; border-radius: var(--radius); font: 500 16px/1 var(--font); text-decoration: none; white-space: nowrap; }
    .btn-primary { background: var(--accent); color: #0B0F14; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: var(--surface); border-color: var(--border); color: var(--text); }
    .btn-secondary:hover { background: var(--surface-muted); }
    .site-header { position: sticky; top: 0; z-index: 20; background: var(--bg); border-bottom: 1px solid var(--border); }
    .site-header .container { display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); min-height: 72px; }
    .brand img { width: 168px; }
    .header-actions { display: flex; gap: var(--s-3); }
    .trilha ol { display: flex; flex-wrap: wrap; gap: var(--s-2); padding-top: var(--s-6); color: var(--text-muted); font-size: 14px; }
    .trilha li + li::before { content: "›"; margin-right: var(--s-2); }
    .trilha a { color: var(--text-muted); }
    .trilha a:hover { color: var(--text); }
    .hero { padding: var(--s-8) 0 var(--section-gap); }
    .kicker { color: var(--accent-text); font-size: 14px; font-weight: 500; margin-bottom: var(--s-4); }
    .lead { margin-top: var(--s-6); color: var(--text-muted); font-size: 18px; max-width: 70ch; }
    .acoes { display: flex; flex-wrap: wrap; gap: var(--s-3); margin-top: var(--s-8); }
    .texto { max-width: 76ch; display: grid; gap: var(--s-4); color: var(--text-muted); font-size: 17px; }
    .blocos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-4); }
    .bloco { padding: var(--s-6); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
    .bloco-largo { grid-column: 1 / -1; }
    .bloco h3 { margin-bottom: var(--s-3); }
    .bloco ul { display: grid; gap: var(--s-2); color: var(--text-muted); }
    .bloco-largo ul { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s-8); }
    .bloco li { position: relative; padding-left: var(--s-4); }
    .bloco li::before { content: ""; position: absolute; left: 0; top: 0.65em; width: 6px; height: 6px; border-radius: 1px; background: var(--accent); }
    .fluxo { counter-reset: passo; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s-4); }
    .fluxo li { counter-increment: passo; padding: var(--s-6); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
    .fluxo li::before { content: counter(passo); display: grid; place-items: center; width: 32px; height: 32px; margin-bottom: var(--s-4); background: var(--accent-soft); color: var(--accent-text); border-radius: var(--radius); font-size: 14px; font-weight: 600; }
    .fluxo p { margin-top: var(--s-2); color: var(--text-muted); }
    .em-breve { display: inline-block; margin-top: var(--s-2); padding: 1px 8px; border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-muted); font-size: 13px; font-weight: 500; }
    .faq details { border-bottom: 1px solid var(--border); }
    .faq details:first-child { border-top: 1px solid var(--border); }
    .faq summary { display: flex; align-items: center; justify-content: space-between; gap: var(--s-4); min-height: 56px; padding: var(--s-3) 0; cursor: pointer; list-style: none; }
    .faq summary::-webkit-details-marker { display: none; }
    .faq summary::after { content: "+"; color: var(--text-muted); font-size: 22px; line-height: 1; }
    .faq details[open] summary::after { content: "−"; }
    .faq details p { padding-bottom: var(--s-6); max-width: 76ch; color: var(--text-muted); }
    .metodos { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--s-4); }
    .metodos a { display: block; height: 100%; padding: var(--s-6); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); text-decoration: none; }
    .metodos a:hover { border-color: var(--accent); }
    .metodos strong { display: block; font-size: 17px; }
    .metodos span { display: block; margin-top: var(--s-1); color: var(--accent-text); font-size: 14px; font-weight: 500; }
    .metodos p { margin-top: var(--s-2); color: var(--text-muted); font-size: 15px; }
    .grupo + .grupo { margin-top: var(--s-12); }
    .grupo h2 { margin-bottom: var(--s-6); font-size: 22px; }
    .mais { margin-top: var(--s-6); }
    .fechamento { background: var(--surface); }
    .fechamento .container { display: flex; align-items: center; justify-content: space-between; gap: var(--s-8); }
    .fechamento p { margin-top: var(--s-3); max-width: 60ch; color: var(--text-muted); font-size: 18px; }
    .site-footer { padding: var(--s-12) 0 var(--s-8); border-top: 1px solid var(--border); }
    .footer-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) repeat(3, minmax(0, 1fr)); gap: var(--s-8); }
    .footer-brand img { width: 168px; margin-bottom: var(--s-4); }
    .footer-brand p { max-width: 34ch; color: var(--text-muted); font-size: 14px; }
    .footer-title { margin-bottom: var(--s-3); font-size: 14px; font-weight: 600; }
    .site-footer li + li { margin-top: var(--s-2); }
    .site-footer li a { color: var(--text-muted); font-size: 14px; text-decoration: none; }
    .site-footer li a:hover { color: var(--text); }
    .footer-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--s-2); margin-top: var(--s-8); padding-top: var(--s-6); border-top: 1px solid var(--border); color: var(--text-muted); font-size: 13px; }
    @media (max-width: 960px) {
      .fluxo { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .footer-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .footer-brand { grid-column: 1 / -1; }
      .fechamento .container { flex-direction: column; align-items: flex-start; }
    }
    @media (max-width: 640px) {
      :root { --section-gap: 48px; }
      .container { padding: 0 var(--s-4); }
      .brand img { width: 136px; }
      .header-actions .btn-primary { display: none; }
      .acoes .btn, .fechamento .btn { width: 100%; }
      .blocos, .bloco-largo ul, .fluxo { grid-template-columns: minmax(0, 1fr); }
      .footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }`

function pagina({ titulo, descricao, canonico, trilha, conteudo, dados }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descricao)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="#0B0F14">
  <link rel="canonical" href="${canonico}">
  <link rel="icon" type="image/png" href="/assets/favicon.png">
  <link rel="apple-touch-icon" href="/assets/favicon.png">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="AXOS Relatórios">
  <meta property="og:title" content="${esc(titulo.replace(/ \| AXOS Relatórios$/, ''))}">
  <meta property="og:description" content="${esc(descricao)}">
  <meta property="og:url" content="${canonico}">
  <meta property="og:image" content="${SITE}/assets/og-laudos-end.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">
${jsonLd({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: trilha.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.nome, item: t.url })) },
    ...dados,
  ] })}
  </script>
  <style>${ESTILO}
  </style>
</head>
<body>
  <a class="skip" href="#conteudo">Ir para o conteúdo</a>
  <header class="site-header">
    <div class="container">
      <a class="brand" href="/" aria-label="AXOS Relatórios, página inicial">
        <img src="/assets/logo-axos.png" alt="AXOS Relatórios, tecnologia em inspeção" width="578" height="165">
      </a>
      <div class="header-actions">
        <a class="btn btn-secondary" href="/app?entrar=1">Entrar</a>
        <a class="btn btn-primary" href="/#valores">Ver planos</a>
      </div>
    </div>
  </header>
  <main id="conteudo">
    <nav class="trilha container" aria-label="Você está em">
      <ol>
${trilha.map((t, i) => (i === trilha.length - 1
    ? `        <li aria-current="page">${esc(t.nome)}</li>`
    : `        <li><a href="${t.url.replace(SITE, '')}">${esc(t.nome)}</a></li>`)).join('\n')}
      </ol>
    </nav>
${conteudo}
    <section class="section fechamento" aria-labelledby="chamada-final">
      <div class="container">
        <div>
          <h2 id="chamada-final">Teste o AXOS Relatórios nos laudos da sua empresa</h2>
          <p>São 30 dias grátis. Você informa o cartão ao contratar e a primeira cobrança vem depois desse prazo.</p>
        </div>
        <a class="btn btn-primary" href="/#valores">Ver planos e valores</a>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="/assets/logo-axos.png" alt="AXOS Relatórios" width="578" height="165" loading="lazy">
          <p>Plataforma de laudos de ensaios não destrutivos para empresas de inspeção que atendem indústria, energia, óleo e gás, naval e construção.</p>
        </div>
${Object.entries(GRUPOS).map(([grupo, nome]) => `        <nav aria-label="${esc(nome)}">
          <p class="footer-title">${esc(nome)}</p>
          <ul>
${METODOS.filter((m) => m.grupo === grupo).map((m) => `            <li><a href="/laudos/${m.slug}/">${esc(m.nome)}</a></li>`).join('\n')}
          </ul>
        </nav>`).join('\n')}
        <nav aria-label="AXOS Relatórios">
          <p class="footer-title">AXOS Relatórios</p>
          <ul>
            <li><a href="/">Página inicial</a></li>
            <li><a href="/laudos/">Todos os métodos</a></li>
            <li><a href="/#valores">Valores</a></li>
            <li><a href="/#perguntas">Perguntas frequentes</a></li>
            <li><a href="${DEMO}">Solicitar demonstração</a></li>
          </ul>
        </nav>
      </div>
      <div class="footer-bottom">
        <span>© 2026 AXOS Relatórios. Todos os direitos reservados. CNPJ 26.998.571/0001-50</span>
        <span><a href="/termos-de-uso.html">Termos de Uso</a> · <a href="/politica-de-privacidade.html">Política de Privacidade</a></span>
      </div>
    </div>
  </footer>
</body>
</html>
`
}

const FLUXO = `    <section class="section" aria-labelledby="fluxo-titulo">
      <div class="container">
        <div class="section-head">
          <h2 id="fluxo-titulo">Do campo à emissão</h2>
        </div>
        <ol class="fluxo">
          <li><h3>O inspetor registra em campo</h3><p>No notebook, no tablet ou no celular, com ou sem internet.</p></li>
          <li><h3>Os dados sincronizam sozinhos</h3><p>Quando a conexão volta, o laudo e as fotos sobem para o servidor sem duplicar nada.</p></li>
          <li><h3>O engenheiro revisa e aprova</h3><p>O Profissional Habilitado aprovará ou devolverá com comentário.</p><span class="em-breve">Em desenvolvimento</span></li>
          <li><h3>O laudo é emitido e verificável</h3><p>Número definitivo, cabeçalho congelado e PDF com a marca da sua empresa.</p><span class="em-breve">Em desenvolvimento</span></li>
        </ol>
      </div>
    </section>`

const cartaoMetodo = (m) => `          <li><a href="/laudos/${m.slug}/"><strong>${esc(m.nome)}</strong><span>${esc(m.sigla)}</span><p>${esc(m.resumo)}</p></a></li>`

function paginaMetodo(m) {
  const faq = perguntas(m)
  const conteudo = `    <section class="hero">
      <div class="container">
        <p class="kicker">Método END · ${m.grupo === 'convencional' ? 'Ensaio convencional' : 'Ensaio avançado ou especial'} · ${esc(m.sigla)}</p>
        <h1>${esc(m.h1)}</h1>
        <p class="lead">${esc(m.intro)}</p>
        <div class="acoes">
          <a class="btn btn-primary" href="/#valores">Ver planos e valores</a>
          <a class="btn btn-secondary" href="${DEMO}">Solicitar demonstração</a>
        </div>
      </div>
    </section>
    <section class="section" aria-labelledby="metodo-titulo">
      <div class="container">
        <div class="section-head">
          <h2 id="metodo-titulo">Como funciona o ensaio de ${esc(chamada(m))}</h2>
        </div>
        <div class="texto">
${m.explicacao.map((p) => `          <p>${esc(p)}</p>`).join('\n')}
        </div>
      </div>
    </section>
    <section class="section" aria-labelledby="registra-titulo">
      <div class="container">
        <div class="section-head">
          <h2 id="registra-titulo">O que o laudo de ${esc(m.sigla)} registra no AXOS Relatórios</h2>
          <p>Os campos abaixo são os do formulário de ${esc(m.sigla)} do sistema. O que for obrigatório depende do procedimento da sua empresa e do contrato.</p>
        </div>
        <div class="blocos">
${blocos(m).map((b) => `          <div class="bloco${b.largo ? ' bloco-largo' : ''}">
            <h3>${esc(b.titulo)}</h3>
            <ul>
${b.itens.map((i) => `              <li>${esc(i)}</li>`).join('\n')}
            </ul>
          </div>`).join('\n')}
        </div>
      </div>
    </section>
${FLUXO}
    <section class="section" aria-labelledby="perguntas-titulo">
      <div class="container">
        <div class="section-head">
          <h2 id="perguntas-titulo">Perguntas sobre o laudo de ${esc(m.sigla)}</h2>
        </div>
        <div class="faq">
${faq.map((q, i) => `          <details${i === 0 ? ' open' : ''}>
            <summary><h3>${esc(q.p)}</h3></summary>
            <p>${esc(q.r)}</p>
          </details>`).join('\n')}
        </div>
      </div>
    </section>
    <section class="section" aria-labelledby="outros-titulo">
      <div class="container">
        <div class="section-head">
          <h2 id="outros-titulo">Outros métodos</h2>
        </div>
        <ul class="metodos">
${m.relacionados.map((c) => cartaoMetodo(PORCODIGO[c])).join('\n')}
        </ul>
        <p class="mais"><a href="/laudos/">Ver os 16 métodos</a></p>
      </div>
    </section>`
  return pagina({
    titulo: m.titulo,
    descricao: m.descricao,
    canonico: url(m),
    trilha: [
      { nome: 'Início', url: `${SITE}/` },
      { nome: 'Métodos END', url: `${SITE}/laudos/` },
      { nome: m.nome, url: url(m) },
    ],
    conteudo,
    dados: [{
      '@type': 'FAQPage',
      mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.p, acceptedAnswer: { '@type': 'Answer', text: q.r } })),
    }],
  })
}

function paginaIndice() {
  const conteudo = `    <section class="hero">
      <div class="container">
        <p class="kicker">Métodos END</p>
        <h1>Laudos de ensaios não destrutivos por método</h1>
        <p class="lead">O AXOS Relatórios tem formulário próprio para cada um dos 16 métodos de END, dos ensaios convencionais às técnicas avançadas. Escolha o método para ver o que o laudo registra.</p>
      </div>
    </section>
    <section class="section" aria-label="Lista de métodos">
      <div class="container">
${Object.entries(GRUPOS).map(([grupo, nome]) => `        <div class="grupo">
          <h2>${esc(nome)}</h2>
          <ul class="metodos">
${METODOS.filter((m) => m.grupo === grupo).map((m) => '  ' + cartaoMetodo(m)).join('\n')}
          </ul>
        </div>`).join('\n')}
      </div>
    </section>
    <section class="section" aria-labelledby="comum-titulo">
      <div class="container">
        <div class="section-head">
          <h2 id="comum-titulo">O que todo laudo tem</h2>
          <p>Além dos campos de cada método, todos os laudos seguem o mesmo padrão.</p>
        </div>
        <div class="blocos">
          <div class="bloco"><h3>Identificação</h3><ul><li>Cliente, obra, equipamento e item ensaiado</li><li>Procedimento, norma de referência e critério de aceitação</li></ul></div>
          <div class="bloco"><h3>Fotos e croqui</h3><ul><li>Fotos e telas do aparelho, com legenda</li><li>Croqui ou esboço desenhado na própria tela</li></ul></div>
          <div class="bloco"><h3>Responsável técnico</h3><ul><li>Inspetor e qualificação SNQC usada no laudo</li><li>Responsável técnico da empresa</li></ul></div>
          <div class="bloco"><h3>Em campo, sem internet</h3><ul><li>Preenchido no notebook, no tablet ou no celular</li><li>Dados e fotos sobem quando a conexão volta</li></ul></div>
        </div>
      </div>
    </section>
${FLUXO}`
  return pagina({
    titulo: 'Laudos END por Método: os 16 Ensaios | AXOS Relatórios',
    descricao: 'Veja o que o laudo de cada um dos 16 métodos de END registra no AXOS Relatórios: ensaio visual, líquidos penetrantes, ultrassom, radiografia, Phased Array e mais.',
    canonico: `${SITE}/laudos/`,
    trilha: [{ nome: 'Início', url: `${SITE}/` }, { nome: 'Métodos END', url: `${SITE}/laudos/` }],
    conteudo,
    dados: [{
      '@type': 'ItemList',
      itemListElement: METODOS.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.nome, url: url(m) })),
    }],
  })
}

const destino = fileURLToPath(new URL('../../landing/laudos/', import.meta.url))
rmSync(destino, { recursive: true, force: true })
mkdirSync(destino, { recursive: true })
writeFileSync(`${destino}index.html`, paginaIndice(), 'utf8')
for (const m of METODOS) {
  mkdirSync(`${destino}${m.slug}`, { recursive: true })
  writeFileSync(`${destino}${m.slug}/index.html`, paginaMetodo(m), 'utf8')
  for (const [nome, texto, limite] of [['título', m.titulo, 65], ['descrição', m.descricao, 160]]) {
    if (texto.length > limite) console.warn(`Aviso: ${nome} de ${m.codigo} tem ${texto.length} caracteres (ideal até ${limite}).`)
  }
}
console.log(`${METODOS.length + 1} páginas gravadas em`, destino)
