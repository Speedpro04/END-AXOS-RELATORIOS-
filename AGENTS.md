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
