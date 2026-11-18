# Análise de lacunas: ISO/IEC 27001, ISO 9001 e certificação ABNT

Data da análise: 08/11/2026, atualizada em 18/11/2026 (API publicada, PDF oficial e verificação pública). Base: leitura do repositório, testes locais e consulta ao site no ar.

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
| Autenticação | A.8.5 | Parcial | JWT com audiência e bloqueio de usuário inativo. A API valida a assinatura ES256 pela chave pública do projeto (e HS256 se houver segredo). Não há MFA nem limite de tentativas no login |
| Acesso privilegiado | A.8.2 | Parcial | `avanco.py`, `security.py`, `pdf/laudo_pdf.py` e `routers/verificacao.py` usam a chave `service_role`, que ignora a RLS. No PDF oficial o acesso é conferido antes com o token do usuário; a verificação pública só devolve dados mínimos. O filtro por empresa fica no código. O relatório de avanço pode usar o token do usuário |
| Segredos | A.8.24 | Parcial | Nenhum `.env` versionado. Falta procedimento de troca de chaves |
| Vulnerabilidades | A.8.8 | Parcial | `npm audit` do frontend sem achados. Sem verificação do Python, sem rotina e sem arquivo de versões travadas no backend (`pyproject.toml` usa só versão mínima) |
| Configuração segura | A.8.9 | Parcial | Container da API sem root e documentação da API desligada fora de depuração. O site no ar envia HSTS; a CSP está em modo de observação (`Report-Only`) porque a página inicial tem scripts escritos no HTML. O CORS da API aceita `localhost` em produção. A imagem do frontend não define usuário sem root |
| Limite de requisições | A.8.6 | Parcial | Limite por origem (Redis) no formulário de contratação e na verificação pública. Sem limite nas rotas com login |
| Registros de auditoria | A.8.15 | Parcial | `audit_log` imutável por gatilho. Logs da API são texto simples, sem identificador de requisição nem retenção definida. O worker de e-mail registra o endereço do destinatário |
| Monitoramento | A.8.16 | Falta | Só existe `/healthz`. Sem alertas nem acompanhamento de erros |
| Cópias de segurança | A.8.13 | Falta | Sem política nem teste de restauração registrado |
| Desenvolvimento seguro | A.8.25, A.8.28 | Parcial | Revisão e testes existem, sem processo documentado. Sem análise automática de código |
| Testes | A.8.29 | Parcial | 65 testes no backend (incluindo PDF oficial e verificação pública) e testes de banco passam. Nenhum teste automatizado no frontend |
| Separação de ambientes | A.8.31 | Falta | Sem ambiente de homologação identificado. Desenvolvimento e produção usam o mesmo tipo de configuração manual |
| Gestão de mudanças | A.8.32 | Parcial | Histórico no Git. Sem revisão obrigatória e sem CI: a pasta `.github` não existe. Publicação é manual |
| Código sem uso | A.8.28 | Falta | `sync_worker.py` chama a função `upsert_laudo`, que não existe no banco. A tela `USPage.tsx` não está ligada ao sistema |
| Dados pessoais | A.5.34 | Parcial | Termos, Política, aceites, pedidos de titulares e anonimização no banco. Pedido de contratação sem pagamento é apagado depois de 7 dias. Faltam os demais prazos de guarda, responsável, tela de pedidos e revisão jurídica |
| Armazenamento de evidências | A.8.13 | Parcial | Fotos vão ao bucket privado com hash conferido na leitura e teste de isolamento; a API foi publicada em 18/11/2026. O PDF oficial confere o SHA-256 de cada foto antes de usá-la. Falta testar o envio e o PDF no Storage real com conta real |
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
| Informação documentada | 7.5 | Parcial | `PRD.md`, `MEMORY.md` e Git existem. Nos laudos (registros): emitido travado pelo banco, correção só por nova revisão, número sequencial do servidor, SHA-256 do conteúdo, PDF único por revisão registrado com SHA-256 e verificação pública por QR. Falta controle de versão e aprovação dos documentos da empresa e o teste do fluxo com conta real |
| Projeto e desenvolvimento | 8.3 | Parcial | Há requisitos e testes. Faltam revisão e validação registradas, inclusive por profissional de END nos formulários |
| Fornecedores | 8.4 | Falta | Critério e avaliação |
| Atendimento e reclamações | 8.2, 9.1.2 | Falta | Só existe um e-mail de contato |
| Indicadores | 9.1 | Falta | Definir o que medir |
| Auditoria e análise crítica | 9.2, 9.3 | Falta | Rotina anual, no mínimo |
| Não conformidade e correção | 10.2 | Falta | Registro de falhas e correções |

## Prioridades técnicas

1. Testar com conta real o fluxo completo: laudo de obra, fotos no Storage, envio, aprovação, emissão, PDF oficial e verificação pública. (API publicada e variáveis do EasyPanel acertadas em 18/11/2026.)
2. Definir cópia de segurança e fazer um teste de restauração.
3. Ativar a CSP de verdade (tirar os scripts da página inicial para arquivos), limite de requisições nas rotas com login e logs com identificador de requisição.
4. Criar CI com testes, verificação de dependências e análise de código, e travar as versões do backend.
5. Reduzir o uso da chave `service_role` e remover o código sem uso.
6. Criar homologação, monitoramento e alertas.

## Próximos passos fora do código

1. Definir o escopo e conversar com o certificador ou consultor.
2. Nomear os responsáveis por segurança, qualidade e privacidade.
3. Fazer a análise de riscos e escrever as políticas.
