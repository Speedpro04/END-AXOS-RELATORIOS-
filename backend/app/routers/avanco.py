"""
╔═════════════════════════════════════════════════════════════════════╗
║     ROTA /api/avanco – Avanço de Obras (Módulo Plano Empresas)     ║
╠════════════════════════════════════════════════════════════════════╣
║  Cálculo de avanço de escopo por obra, baseado apenas em           ║
║  laudos emitidos (aprovados e sincronizados).                      ║
║                                                                   ║
║  Regras de cálculo (seção 4 do briefing):                          ║
║   1. Só contam laudos emitidos (aprovados + sincronizados).        ║
║   2. Revisão: conta apenas a revisão mais recente.                 ║
║   3. Laudo reprovado conta como inspecionado, não como aprovado.   ║
║   4. Reinspeção: reprovado virado aprovado conta como aprovado,    ║
║      sem contar de novo como inspecionado.                         ║
║   5. Avanço aprovado % = aprovado / previsto.                      ║
║      Avanço inspecionado % = inspecionado / previsto.              ║
║   6. Se > 100% do previsto → excesso de escopo (sugerir aditivo).  ║
║   7. Previsão de término: ritmo médio últimas 4 semanas.           ║
╚════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import create_client

from app.core.config import settings
from app.core.security import CurrentUserDep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/avanco", tags=["Avanço de Obras (Plano Empresas)"])

# ----------------------------------------------------------------------
# Schemas de resposta
# ----------------------------------------------------------------------

class LinhaAvanço(BaseModel):
    linha_id: str
    metodo: str
    unidade: str
    quantidade_prevista: float
    quantidade_inspecionada: float
    quantidade_aprovada: float
    quantidade_reprovada: float
    avancao_aprovado_pct: float
    avancao_inspecionado_pct: float
    excesso_escopo: bool


class ResumoObra(BaseModel):
    obra_id: str
    obra_nome: str
    total_previsto: float
    total_inspecionado: float
    total_aprovado: float
    total_reprovado: float
    avancao_aprovado_pct: float
    avancao_inspecionado_pct: float
    excesso_escopo: bool
    data_atualizacao: str
    metodo: str | None = None


class Previsão(BaseModel):
    obra_id: str
    saldo_restante: float
    ritmo_medio_semanal: float | None
    semanas_estimadas: float | None
    dados_insuficientes: bool
    data_estimada: str | None = None


class AvanceObraResponse(BaseModel):
    resumo: ResumoObra
    linhas: list[LinhaAvanço]
    previsao: Previsão


# ----------------------------------------------------------------------
# Helpers internos
# ----------------------------------------------------------------------

UNIDADES_VALIDAS = {'junta', 'ponto_medicao', 'peca', 'metro_linear', 'm2', 'filme', 'equipamento'}


def _mes_ano(dt: datetime) -> str:
    return dt.strftime('%Y-%m')


def _semanas_entre(dt_inicial: datetime, dt_final: datetime) -> int:
    delta = dt_final - dt_inicial
    return max(1, delta.days // 7)


def _ultimas_4_semanas() -> tuple[datetime, datetime]:
    hoje = datetime.utcnow()
    inicial = hoje - timedelta(weeks=4)
    return inicial, hoje


# ----------------------------------------------------------------------
# Endpoint: avanço por obra
# ----------------------------------------------------------------------

@router.get(
    '/{obra_id}',
    summary='Avanço de escopo de uma obra (apenas laudos emitidos)',
    response_model=AvanceObraResponse,
)
async def avanco_obra(
    obra_id: str,
    current_user: CurrentUserDep,
    metodo: str | None = None,
    sb: Any = Depends(lambda: create_client(settings.supabase_url, settings.supabase_key)),
) -> AvanceObraResponse:
    """
    Retorna o avanço de escopo de uma obra, calculado no servidor
    baseado apenas em laudos emitidos (aprovados + sincronizados).
    """
    tenant_id = current_user.tenant_id

    # Verifica se a obra pertence ao tenant
    obra = sb.table('sites').select('id, name, client_id').eq('id', obra_id).eq('tenant_id', tenant_id).execute()
    if not obra.data or len(obra.data) == 0:
        raise HTTPException(status_code=404, detail='Obra não encontrada neste tenant')
    obra_nome = obra.data[0]['name']

    # Busca linhas de escopo ativas da obra
    linhas_query = sb.table('obra_escopo_linha').select('*').eq('tenant_id', tenant_id).eq('site_id', obra_id).eq('ativo', True)
    if metodo:
        linhas_query = linhas_query.eq('method', metodo)
    linhas_res = linhas_query.execute()
    linhas = linhas_res.data or []

    if not linhas:
        return AvanceObraResponse(
            resumo=ResumoObra(
                obra_id=obra_id,
                obra_nome=obra_nome,
                total_previsto=0,
                total_inspecionado=0,
                total_aprovado=0,
                total_reprovado=0,
                avancao_aprovado_pct=0,
                avancao_inspecionado_pct=0,
                excesso_escopo=False,
                data_atualizacao=datetime.utcnow().isoformat(),
                metodo=metodo,
            ),
            linhas=[],
            previsao=Previsão(
                obra_id=obra_id,
                saldo_restante=0,
                ritmo_medio_semanal=None,
                semanas_estimadas=None,
                dados_insuficientes=True,
            ),
        )

    linha_ids = [l['id'] for l in linhas]

    # Busca vínculos laudo-escopo para estas linhas
    vinculos_res = sb.table('laudo_escopo_vinculo').select('*').eq('tenant_id', tenant_id).in_('linha_id', linha_ids).execute()
    vinculos = vinculos_res.data or []

    # Para cada laudo vinculado, pega o status mais recente (revisão mais recente)
    laudo_ids = list({v['laudo_id'] for v in vinculos})
    laudos_mais_recentes: dict[str, dict] = {}

    for laudo_id in laudo_ids:
        # Busca todas as revisões do laudo, ordenadas por revision desc
        revs = sb.table('reports').select('id, status, server_status, revision, submitted_at, approved_at, issued_at').eq('id', laudo_id).eq('tenant_id', tenant_id).order('revision', desc=True).execute()
        if revs.data and len(revs.data) > 0:
            laudos_mais_recentes[laudo_id] = revs.data[0]

    # Agrega por linha de escopo, considerando apenas laudos emitidos (aprovado + sincronizado)
    agregado: dict[str, dict] = {}
    for l in linhas:
        agregado[l['id']] = {
            'linha_id': l['id'],
            'metodo': l['method'],
            'unidade': l['unidade'],
            'quantidade_prevista': float(l['quantidade_prevista']),
            'quantidade_inspecionada': 0.0,
            'quantidade_aprovada': 0.0,
            'quantidade_reprovada': 0.0,
        }

    for v in vinculos:
        laudo_id = v['laudo_id']
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue
        # Regra 1: só conta laudo emitido (aprovado e sincronizado)
        if laudo.get('status') != 'approved' or laudo.get('server_status') != 'sincronizado':
            continue

        linha_id = v['linha_id']
        if linha_id not in agregado:
            continue

        qtd_insp = float(v.get('quantidade_inspecionada') or 0)
        qtd_aprov = float(v.get('quantidade_aprovada') or 0)
        qtd_reprov = float(v.get('quantidade_reprovada') or 0)

        a = agregado[linha_id]

        # Regra 4 (reinspeção): se tem laudo_origem, a reprovação anterior já foi contada
        # como inspecionada lá. Aqui só somamos o que este laudo traz de novo.
        # Se há laudo_origem, a quantidade reprovada deste laudo não soma novamente como inspecionada
        # (já foi contada no laudo original). Somos conservadores: somamos aprovado e inspecionado
        # normalmente, mas a regra 4 diz que não conta de novo como inspecionado.
        # Implementação prática: aprovado soma, inspecionado soma apenas se não houver laudo_origem
        # para a parte reprovada. Simplificação aceitável: aprovado sempre soma; inspecionado soma
        # somente a parte que não vem de reinspeção de reprovado.
        if laudo.get('laudo_origem_id'):
            # Reinspeção: aprovado conta como aprovado; reprovado não soma inspecionado de novo
            a['quantidade_aprovada'] += qtd_aprov
            # inspecionado: só a parte aprovada nova (reprovado já foi contado antes)
            a['quantidade_inspecionada'] += qtd_aprov
        else:
            a['quantidade_inspecionada'] += qtd_insp
            a['quantidade_aprovada'] += qtd_aprov
            a['quantidade_reprovada'] += qtd_reprov

    # Monta linhas de avanço
    linhas_avanco: list[LinhaAvanço] = []
    total_previsto = 0.0
    total_inspecionado = 0.0
    total_aprovado = 0.0
    total_reprovado = 0.0

    for l in linhas:
        a = agregado[l['id']]
        previsto = a['quantidade_prevista']
        inspecionado = a['quantidade_inspecionada']
        aprovado = a['quantidade_aprovada']
        reprovado = a['quantidade_reprovada']

        av_aprovado = (aprovado / previsto * 100) if previsto > 0 else 0.0
        av_inspecionado = (inspecionado / previsto * 100) if previsto > 0 else 0.0
        excesso = av_aprovado > 100 or av_inspecionado > 100

        linhas_avanco.append(LinhaAvanço(
            linha_id=a['linha_id'],
            metodo=a['metodo'],
            unidade=a['unidade'],
            quantidade_prevista=previsto,
            quantidade_inspecionada=inspecionado,
            quantidade_aprovada=aprovado,
            quantidade_reprovada=reprovado,
            avancao_aprovado_pct=round(av_aprovado, 2),
            avancao_inspecionado_pct=round(av_inspecionado, 2),
            excesso_escopo=excesso,
        ))

        total_previsto += previsto
        total_inspecionado += inspecionado
        total_aprovado += aprovado
        total_reprovado += reprovado

    av_aprovado_total = (total_aprovado / total_previsto * 100) if total_previsto > 0 else 0.0
    av_inspecionado_total = (total_inspecionado / total_previsto * 100) if total_previsto > 0 else 0.0
    excesso_total = av_aprovado_total > 100 or av_inspecionado_total > 100

    # Previsão de término (regra 7): ritmo médio últimas 4 semanas
    dt_inicial, dt_final = _ultimas_4_semanas()
    semanas = _semanas_entre(dt_inicial, dt_final)

    # Quantidade aprovada nas últimas 4 semanas
    aprovado_4semanas = 0.0
    for v in vinculos:
        laudo_id = v['laudo_id']
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue
        if laudo.get('status') != 'approved' or laudo.get('server_status') != 'sincronizado':
            continue
        issued_at = laudo.get('issued_at')
        if not issued_at:
            continue
        try:
            dt_issued = datetime.fromisoformat(issued_at.replace('Z', '+00:00')).replace(tzinfo=None)
        except Exception:
            continue
        if dt_inicial <= dt_issued <= dt_final:
            aprovado_4semanas += float(v.get('quantidade_aprovada') or 0)

    ritmo_medio_semanal = aprovado_4semanas / semanas if semanas > 0 else None
    saldo_restante = max(0, total_previsto - total_aprovado)
    semanas_estimadas = (saldo_restante / ritmo_medio_semanal) if (ritmo_medio_semanal and ritmo_medio_semanal > 0) else None
    dados_insuficientes = semanas < 4

    if semanas_estimadas is not None:
        data_estimada = (datetime.utcnow() + timedelta(weeks=semanas_estimadas)).isoformat()
    else:
        data_estimada = None

    return AvanceObraResponse(
        resumo=ResumoObra(
            obra_id=obra_id,
            obra_nome=obra_nome,
            total_previsto=total_previsto,
            total_inspecionado=total_inspecionado,
            total_aprovado=total_aprovado,
            total_reprovado=total_reprovado,
            avancao_aprovado_pct=round(av_aprovado_total, 2),
            avancao_inspecionado_pct=round(av_inspecionado_total, 2),
            excesso_escopo=excesso_total,
            data_atualizacao=datetime.utcnow().isoformat(),
            metodo=metodo,
        ),
        linhas=linhas_avanco,
        previsao=Previsão(
            obra_id=obra_id,
            saldo_restante=saldo_restante,
            ritmo_medio_semanal=round(ritmo_medio_semanal, 2) if ritmo_medio_semanal else None,
            semanas_estimadas=round(semanas_estimadas, 1) if semanas_estimadas else None,
            dados_insuficientes=dados_insuficientes,
            data_estimada=data_estimada,
        ),
    )
