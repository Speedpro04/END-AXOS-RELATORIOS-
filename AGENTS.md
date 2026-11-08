# Regras Permanentes — Projeto AXOS Relatórios

## 1. Terminologia END (obrigatória)

- **Nunca escrever a sigla inglesa proibida (nenhuma capitalização)** em UI, textos, comentários, identificadores, mocks, testes ou docs. Usar sempre "END" (Ensaios Não Destrutivos).
- Se o usuário ou exemplo externo usar a sigla inglesa proibida, converter para "END" sem perguntar.
- Antes de concluir qualquer tarefa, rodar busca por a sigla inglesa proibida (case-insensitive, palavra inteira) excluindo node_modules, dev-dist e .git → resultado esperado: ZERO ocorrências.

## 2. Diretrizes Comportamentais (Karpathy Guidelines)

Todas as operações seguem a skill https://github.com/multica-ai/andrej-karpathy-skills.git (base obrigatória):

1. **Think Before Coding** — não assumir; esclarecer dúvidas; expor tradeoffs.
2. **Simplicity First** — código mínimo; nada especulativo; sem superengenharia.
3. **Surgical Changes** — tocar apenas o necessário; não refatorar o que não está quebrado.
4. **Goal-Driven Execution** — definir critérios de sucesso verificáveis; loopar até verificar.

## 3. Referência de Documentação

- `PRD.md` — Requisitos do Produto (seção 6: Terminologia END; seção 5: Karpathy Guidelines).
- `MEMORY.md` — Contexto arquitetural, regra permanente END, histórico de mudanças e pendências.

## 4. Verificações Padrão ao Fim de Cada Tarefa (obrigatórias)

- **Frontend:** rodar `npx tsc -b` dentro de `frontend/` — resultado esperado: sem erros de tipo.
- **Backend Python:** rodar `python -m py_compile` em cada `.py` alterado — resultado esperado: sem erros.
- **Terminologia:** busca pela sigla inglesa proibida (case-insensitive, palavra inteira) em todo o repositório, excetuando `node_modules`, `dev-dist` e `.git` — resultado esperado: ZERO ocorrências.
- **Resposta final:** curta e objetiva (arquivos alterados + resultado das verificações), em português, sem jargão técnico desnecessário (o usuário não programa).
- Ao fim de cada etapa, parar; não improvisar em ambiguidades — perguntar antes de seguir.

## 5. Git (commit e push)

- Repositório remoto: `https://github.com/Speedpro04/END-AXOS-RELATORIOS-.git`
- Branch de trabalho: `opencode-obras-wip`
- **Commit e push somente quando o usuário pedir explicitamente.** Nunca commitar credenciais, `.env.local` ou arquivos gerados (`dist/`, `dev-dist/`).
- Mensagem de commit em português, formato `tipo(escopo): descrição curta` (ex.: `fix(frontend): ...`).
- Nunca imprimir senha ou credencial no terminal ou em resumo de commit.

## 6. Testar Sempre (obrigatório)

Nenhuma alteração é dada como pronta sem teste: no navegador, no computador e no celular, quando for visível, e no site no ar depois de publicar. A resposta final diz o que foi testado e o que ficou sem teste.

## 7. Conformidade: ISO 27001, ISO 9001 e ABNT

Objetivo definido pelo dono do produto em 08/11/2026: preparar o AXOS para auditoria e futuras certificações **ISO/IEC 27001 e ISO 9001**, com possibilidade de certificação pela ABNT.

- Essas normas certificam o sistema de gestão da empresa, não o software. Nenhum código, sozinho, torna o AXOS conforme.
- Nenhuma tela, texto ou documento pode declarar conformidade, certificação ou exibir selo antes do certificado emitido.
- Toda mudança de backend, banco ou infraestrutura deve considerar segurança, rastreabilidade e evidência para auditoria.
- Situação e prioridades: `docs/conformidade/analise-de-lacunas.md`. Atualize esse arquivo quando uma lacuna for fechada.
