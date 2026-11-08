# Análise de lacunas: ISO/IEC 27001, ISO 9001 e certificação ABNT

Data da análise: 08/11/2026. Base: leitura do repositório, testes locais e consulta ao site no ar.

Este documento é um ponto de partida para preparar a auditoria. **Não é um parecer de conformidade nem substitui consultor ou organismo certificador.** As referências aos itens das normas foram feitas de memória técnica e precisam ser conferidas no texto oficial.

## O que é certificado

- **ISO/IEC 27001 e ISO 9001 certificam o sistema de gestão da empresa, dentro de um escopo.** Não certificam um software ou um backend. O código só gera parte das evidências.
- **Selo ABNT:** a ABNT Certificadora certifica sistemas de gestão por essas normas e tem uma marca de conformidade própria. A marca só pode ser usada depois do certificado emitido, conforme o manual da ABNT. Até lá, nenhuma página do AXOS deve exibir selo nem declarar conformidade ou certificação.
- **Pontos a definir com o certificador:** escopo, prazo e custo. Não estão levantados neste documento.

## Legenda

- **Tem:** há evidência no repositório, testada.
- **Parcial:** existe, mas incompleto ou não testado em produção.
- **Falta:** não encontrado no repositório. Pode existir fora dele.

## ISO/IEC 27001: controles técnicos

| Assunto | Referência | Situação | Evidência ou lacuna |
|---|---|---|---|
| Isolamento entre empresas | A.8.3 | Parcial | RLS em 20 tabelas e testes de isolamento locais. Falta aplicar e testar no projeto de produção |
| Autenticação | A.8.5 | Parcial | JWT com audiência e bloqueio de usuário inativo. Não há MFA nem limite de tentativas na API. Validação usa só HS256: conferir se o projeto novo do Supabase assina com chave assimétrica |
| Acesso privilegiado | A.8.2 | Parcial | `avanco.py`, `pdf_worker.py` e `security.py` usam a chave `service_role`, que ignora a RLS. O filtro por empresa fica no código. O relatório de avanço pode usar o token do usuário |
| Segredos | A.8.24 | Parcial | Nenhum `.env` versionado. Falta procedimento de troca de chaves |
| Vulnerabilidades | A.8.8 | Parcial | `npm audit` do frontend sem achados. Sem verificação do Python, sem rotina e sem arquivo de versões travadas no backend (`pyproject.toml` usa só versão mínima) |
| Configuração segura | A.8.9 | Parcial | Container da API sem root e documentação da API desligada fora de depuração. O site no ar não envia HSTS nem CSP. O CORS da API aceita `localhost` em produção. A imagem do frontend não define usuário sem root |
| Limite de requisições | A.8.6 | Falta | Sem limite por usuário ou IP na API |
| Registros de auditoria | A.8.15 | Parcial | `audit_log` imutável por gatilho. Logs da API são texto simples, sem identificador de requisição nem retenção definida. O worker de e-mail registra o endereço do destinatário |
| Monitoramento | A.8.16 | Falta | Só existe `/healthz`. Sem alertas nem acompanhamento de erros |
| Cópias de segurança | A.8.13 | Falta | Sem política nem teste de restauração registrado |
| Desenvolvimento seguro | A.8.25, A.8.28 | Parcial | Revisão e testes existem, sem processo documentado. Sem análise automática de código |
| Testes | A.8.29 | Parcial | 19 testes no backend e testes de banco passam. Nenhum teste automatizado no frontend |
| Separação de ambientes | A.8.31 | Falta | Sem ambiente de homologação identificado. Desenvolvimento e produção usam o mesmo tipo de configuração manual |
| Gestão de mudanças | A.8.32 | Parcial | Histórico no Git. Sem revisão obrigatória e sem CI: a pasta `.github` não existe. Publicação é manual |
| Código sem uso | A.8.28 | Falta | `sync_worker.py` chama a função `upsert_laudo`, que não existe no banco. A tela `USPage.tsx` não está ligada ao sistema |
| Dados pessoais | A.5.34 | Parcial | Termos, Política, aceites, pedidos de titulares e anonimização no banco. Faltam prazos de guarda, responsável, tela de pedidos e revisão jurídica |
| Armazenamento de evidências | A.8.13 | Parcial | Envio das fotos ao bucket privado feito no app, com hash conferido na leitura e teste de isolamento. Só passa a valer com a API publicada: sem ela, os laudos não chegam ao servidor e as fotos seguem só no aparelho. Falta testar no Storage real |
| Serviços em nuvem | A.5.23 | Falta | Sem registro de fornecedores, região dos dados e contratos (Supabase e Hostinger) |

## ISO/IEC 27001: gestão (não se resolve com código)

Precisam existir como documentos e prática da empresa, e nada disso foi encontrado no repositório:

- escopo do sistema de gestão (4.3) e política de segurança (5.2);
- análise de riscos e declaração de aplicabilidade (6.1);
- responsáveis, conscientização e treinamento (5.3, 7.3);
- resposta a incidentes (A.5.24) e continuidade (A.5.29);
- auditoria interna (9.2) e análise crítica pela direção (9.3).

## ISO 9001

| Requisito | Referência | Situação | Observação |
|---|---|---|---|
| Escopo e processos | 4.3, 4.4 | Falta | Mapear do pedido do cliente ao suporte |
| Política e objetivos da qualidade | 5.2, 6.2 | Falta | Decisão da direção |
| Riscos e oportunidades | 6.1 | Falta | Pode ser unida à análise da ISO 27001 |
| Informação documentada | 7.5 | Parcial | `PRD.md`, `MEMORY.md` e Git existem. Falta controle de versão e aprovação de documentos |
| Projeto e desenvolvimento | 8.3 | Parcial | Há requisitos e testes. Faltam revisão e validação registradas, inclusive por profissional de END nos formulários |
| Fornecedores | 8.4 | Falta | Critério e avaliação |
| Atendimento e reclamações | 8.2, 9.1.2 | Falta | Só existe um e-mail de contato |
| Indicadores | 9.1 | Falta | Definir o que medir |
| Auditoria e análise crítica | 9.2, 9.3 | Falta | Rotina anual, no mínimo |
| Não conformidade e correção | 10.2 | Falta | Registro de falhas e correções |

## Prioridades técnicas

1. Colocar o básico em produção: variáveis corretas no EasyPanel, banco aplicado e API publicada. O site publicado parece apontar a API para `localhost:8000`, e `api.axosrelatorios.com` não respondeu ao teste.
2. Publicar a API, para as fotos dos laudos chegarem ao servidor. O envio pelo app já está pronto.
3. Definir cópia de segurança e fazer um teste de restauração.
4. Adicionar HSTS e CSP no site, limite de requisições e logs com identificador de requisição.
5. Criar CI com testes, verificação de dependências e análise de código, e travar as versões do backend.
6. Reduzir o uso da chave `service_role` e remover o código sem uso.
7. Criar homologação, monitoramento e alertas.

## Próximos passos fora do código

1. Definir o escopo e conversar com o certificador ou consultor.
2. Nomear os responsáveis por segurança, qualidade e privacidade.
3. Fazer a análise de riscos e escrever as políticas.
