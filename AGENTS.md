# Regras Permanentes — Projeto AXOS Relatórios

## 1. Terminologia END (obrigatória)

- **Nunca escrever a sigla inglesa proibida (nenhuma capitalização)** em UI, textos, comentários, identificadores, mocks, testes ou docs. Usar sempre "END" (Ensaios Não Destrutivos).
- Se o usuário ou exemplo externo usar a sigla inglesa proibida, converter para "END" sem perguntar.
- Antes de concluir qualquer tarefa, rodar busca por a sigla inglesa proibida (case-insensitive, palavra inteira) excluindo node_modules, dev-dist, .git e `backend/.venv` (bibliotecas de terceiros fora do repositório) → resultado esperado: ZERO ocorrências.

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
- **Terminologia:** busca pela sigla inglesa proibida (case-insensitive, palavra inteira) em todo o repositório, excetuando `node_modules`, `dev-dist`, `.git` e `backend/.venv` — resultado esperado: ZERO ocorrências.
- **Resposta final:** curta e objetiva (arquivos alterados + resultado das verificações), em português, sem jargão técnico desnecessário (o usuário não programa).
- **Sempre em português:** toda mensagem ao usuário, inclusive as de andamento entre uma ação e outra.
- Ao fim de cada etapa, parar; não improvisar em ambiguidades — perguntar antes de seguir.

## 5. Git (commit e push)

- Repositório remoto: `https://github.com/Speedpro04/END-AXOS-RELATORIOS-.git`
- Branch de trabalho: `opencode-obras-wip`
- **Commit somente quando o usuário pedir explicitamente.** Nunca commitar credenciais, `.env.local` ou arquivos gerados (`dist/`, `dev-dist/`).
- **Depois de cada commit pedido, enviar a branch de trabalho ao GitHub e atualizar a `main`, sem perguntar e sem forçar.** Se o GitHub recusar, parar e explicar. O Deploy no EasyPanel é feito pelo dono do produto.
- Mensagem de commit em português, formato `tipo(escopo): descrição curta` (ex.: `fix(frontend): ...`).
- Nunca imprimir senha ou credencial no terminal ou em resumo de commit.

## 6. Testar Sempre (obrigatório)

Nenhuma alteração é dada como pronta sem teste: no navegador, no computador, no tablet e no celular, quando for visível, e no site no ar depois de publicar. A resposta final diz o que foi testado e o que ficou sem teste.

Em campo as empresas usam notebook, tablet e iPad, mas o AXOS inteiro tem de funcionar também no celular.

## 7. Pagamentos (Stripe)

- Link de pagamento é público e pode ficar no código. Chave secreta e segredo de webhook ficam só no servidor, nunca em variável `VITE_`, no repositório ou no terminal.
- Plano só é liberado pelo servidor ou pela AXOS. O usuário nunca altera plano nem prazo.
- Não colocar nome, e-mail, CPF ou CNPJ no endereço do pagamento.
- Caminho de quem não tem conta: card, formulário da empresa, pagamento, volta à LP, e-mail para criar a senha, Entrar, login, Obras. A conta só nasce depois do pagamento, criada pelo servidor.
- Teste grátis só com cartão, pela Stripe (30 dias). Não existe teste sem cartão: "Criar conta" na tela de entrar é só para convite da equipe.
- A conta Stripe é da Axos Hub, empresa dona dos produtos: a página de pagamento mostra "Axos Hub", e o nome de cada produto deixa claro que é o AXOS Relatórios.
- Nunca fazer pagamento real em teste. Situação e pendências: seção "Pagamento pela Stripe" em `MEMORY.md`.

## 8. Conformidade: ISO 27001, ISO 9001 e ABNT

Objetivo definido pelo dono do produto em 08/11/2026: preparar o AXOS para auditoria e futuras certificações **ISO/IEC 27001 e ISO 9001**, com possibilidade de certificação pela ABNT.

- Essas normas certificam o sistema de gestão da empresa, não o software. Nenhum código, sozinho, torna o AXOS conforme.
- Nenhuma tela, texto ou documento pode declarar conformidade, certificação ou exibir selo antes do certificado emitido.
- Toda mudança de backend, banco ou infraestrutura deve considerar segurança, rastreabilidade e evidência para auditoria.
- Situação e prioridades: `docs/conformidade/analise-de-lacunas.md`. Atualize esse arquivo quando uma lacuna for fechada.
