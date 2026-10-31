# Melhoria continua (PDCA, inspirado na ISO 9001)

Aplica o ciclo PDCA sobre as artes. Nao e certificacao; e o habito da clausula 10 (melhoria) aplicado ao design.

| Fase | Pratica neste repo |
|---|---|
| Planejar | Objetivo e criterio de aceite no PR; padroes em `tokens/` |
| Fazer | Criar em `products/<produto>/src`, exportar com `scripts/render.sh` |
| Verificar | CI `qa-artes`, `docs/qualidade-checklist.md`, revisao |
| Agir | Registrar em `docs/melhorias/registro.md`, atualizar tokens/templates, CHANGELOG |

## Indicadores (revisao mensal)
- Retrabalho: artes devolvidas depois de publicadas
- Conformidade: falhas do CI por mes (tendencia de queda)
- Reuso: proporcao de telas feitas a partir de `templates/`
- Tempo de entrega por arte

## Revisao mensal (30 min)
1. Ler o registro de melhorias do mes
2. Escolher 1 a 3 melhorias para virar padrao (token, template ou checagem no CI)
3. Atualizar CHANGELOG e `tools.lock.json` se houver upgrade de ferramenta (testar antes)
