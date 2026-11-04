"""
╔═════════════════════════════════════════════════════════════════════╗
║     ROTA /api/avanco – Avanço de Obras (Plano Empresas)           ║
╠════════════════════════════════════════════════════════════════════╣
║  Cálculo de avanço de escopo por obra, baseado apenas em           ║
║  laudos emitidos (status issued).                                  ║
║                                                                   ║
║  Regras de cálculo:                                               ║
║   1. Só contam laudos emitidos (status issued).                   ║
║   2. Para cada document_id, conta só a revisão mais recente       ║
║      com status issued.                                           ║
║   3. Laudo reprovado conta como inspecionado, não como aprovado. ║
║   4. Reinspeção: reprovado virado aprovado conta como aprovado,   ║
║      sem contar de novo como inspecionado.                        ║
║   5. Avanço aprovado % = aprovado / previsto.                     ║
║      Avanço inspecionado % = inspecionado / previsto.             ║
║   6. Se > 100% do previsto → excesso de escopo.                   ║
║   7. Previsão de término: ritmo médio últimas 4 semanas.          ║
╚════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import create_client

from app.core.config import settings
from app.core.security import CurrentUserDep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/avanco", tags=["Avanço de Obras"])

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


class PontoCurvaS(BaseModel):
    semana: str
    previsto: float
    realizado: float


class CurvaS(BaseModel):
    pontos: list[PontoCurvaS]


class FatiaRosca(BaseModel):
    categoria: str
    valor: float
    percentual: float


class Rosca(BaseModel):
    fatias: list[FatiaRosca]
    total: float


class RetrabalhoMetodo(BaseModel):
    metodo: str
    total_laudos: int
    devolvidos: int
    percentual_retrabalho: float
    prazo_medio_dias: float | None


class ProducaoInspetor(BaseModel):
    inspetor_id: str
    inspetor_nome: str
    quantidade_aprovada: float
    quantidade_reprovada: float
    unidade: str


class PendenciaLaudo(BaseModel):
    laudo_id: str
    laudo_codigo: str
    metodo: str
    inspetor_nome: str
    dias_parado: int
    status: str


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
    curva_s: CurvaS
    rosca: Rosca
    retrabalho_por_metodo: list[RetrabalhoMetodo]
    producao_por_inspetor: list[ProducaoInspetor]
    pendencias: list[PendenciaLaudo]
    previsao: Previsão


# ----------------------------------------------------------------------
# Helpers internos
# ----------------------------------------------------------------------

def _semanas_entre(dt_inicial: datetime, dt_final: datetime) -> int:
    delta = dt_final - dt_inicial
    return max(1, delta.days // 7)


def _ultimas_4_semanas() -> tuple[datetime, datetime]:
    hoje = datetime.utcnow()
    inicial = hoje - timedelta(weeks=4)
    return inicial, hoje


def _semana_iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    try:
        d = datetime.fromisoformat(dt.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None
    iso = d.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


# ----------------------------------------------------------------------
# Endpoint: avanço por obra
# ----------------------------------------------------------------------

@router.get(
    "/{obra_id}",
    summary="Avanço de escopo de uma obra (apenas laudos emitidos)",
    response_model=AvanceObraResponse,
)
async def avanco_obra(
    obra_id: str,
    current_user: CurrentUserDep,
    metodo: str | None = None,
    sb: Any = Depends(lambda: create_client(settings.supabase_url, settings.supabase_key)),
) -> AvanceObraResponse:
    tenant_id = current_user.tenant_id

    # Verifica se a obra pertence ao tenant
    obra = sb.table("sites").select("id, name").eq("id", obra_id).eq("tenant_id", tenant_id).execute()
    if not obra.data or len(obra.data) == 0:
        raise HTTPException(status_code=404, detail="Obra não encontrada neste tenant")
    obra_nome = obra.data[0]["name"]

    # Busca linhas de escopo ativas da obra
    linhas_query = sb.table("obra_escopo_linha").select("*").eq("tenant_id", tenant_id).eq("site_id", obra_id).eq("ativo", True)
    if metodo:
        linhas_query = linhas_query.eq("method", metodo)
    linhas_res = linhas_query.execute()
    linhas = linhas_res.data or []

    if not linhas:
        return _vazio(obra_id, obra_nome, metodo)

    linha_ids = [l["id"] for l in linhas]

    # Busca vínculos laudo-escopo para estas linhas (uma única consulta)
    vinculos_res = sb.table("laudo_escopo_vinculo").select("*").eq("tenant_id", tenant_id).in_("linha_id", linha_ids).execute()
    vinculos = vinculos_res.data or []

    if not vinculos:
        return _sem_vinculos(linhas)

    # IDs de todos os laudos vinculados
    laudo_ids = list({v["laudo_id"] for v in vinculos})

    # Busca TODOS os reports de uma vez (elimina N+1)
    reports_res = sb.table("reports").select("id, document_id, revision, status, method, date, issued_at, inspector_name").eq("tenant_id", tenant_id).in_("id", laudo_ids).execute()
    reports = reports_res.data or []

    # Agrupa reports por document_id
    reports_por_documento: dict[str, list[dict]] = {}
    for r in reports:
        reports_por_documento.setdefault(r["document_id"], []).append(r)

    # Para cada document_id, pega a revisão mais recente com status issued
    laudos_mais_recentes: dict[str, dict] = {}  # laudo_id -> report
    for doc_id, revs in reports_por_documento.items():
        revs_issued = [r for r in revs if r.get("status") == "issued"]
        if not revs_issued:
            continue
        mais_recente = max(revs_issued, key=lambda r: r.get("revision", 0))
        laudos_mais_recentes[mais_recente["id"]] = mais_recente

    # Mapeia laudo_id -> vinculo
    vinculo_por_laudo: dict[str, dict] = {}
    for v in vinculos:
        vinculo_por_laudo[v["laudo_id"]] = v

    # Para cada documento emitido, encontra o vínculo (se não tiver, usa da revisão anterior)
    vinculos_emitidos: list[dict] = []
    for laudo_id, laudo in laudos_mais_recentes.items():
        v = vinculo_por_laudo.get(laudo_id)
        if v:
            vinculos_emitidos.append(v)
            continue
        # Não tem vínculo direto: busca a revisão anterior do mesmo document_id
        doc_id = laudo["document_id"]
        revs = reports_por_documento.get(doc_id, [])
        revs_ordenadas = sorted(revs, key=lambda r: r.get("revision", 0), reverse=True)
        for r in revs_ordenadas:
            if r["id"] == laudo_id:
                continue  # pula a própria revisão atual
            v_ant = vinculo_por_laudo.get(r["id"])
            if v_ant:
                vinculos_emitidos.append(v_ant)
                break

    # Agrega por linha de escopo
    agregado: dict[str, dict] = {}
    for l in linhas:
        agregado[l["id"]] = {
            "linha_id": l["id"],
            "metodo": l["method"],
            "unidade": l["unidade"],
            "quantidade_prevista": float(l["quantidade_prevista"]),
            "quantidade_inspecionada": 0.0,
            "quantidade_aprovada": 0.0,
            "quantidade_reprovada": 0.0,
        }

    for v in vinculos_emitidos:
        laudo_id = v["laudo_id"]
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue

        linha_id = v["linha_id"]
        if linha_id not in agregado:
            continue

        qtd_insp = float(v.get("quantidade_inspecionada") or 0)
        qtd_aprov = float(v.get("quantidade_aprovada") or 0)
        qtd_reprov = float(v.get("quantidade_reprovada") or 0)

        a = agregado[linha_id]

        if laudo.get("laudo_origem_id"):
            # Reinspeção: aprovado soma como aprovado; inspecionado só a parte aprovada
            a["quantidade_aprovada"] += qtd_aprov
            a["quantidade_inspecionada"] += qtd_aprov
        else:
            a["quantidade_inspecionada"] += qtd_insp
            a["quantidade_aprovada"] += qtd_aprov
            a["quantidade_reprovada"] += qtd_reprov

    # Monta linhas de avanço
    linhas_avanco: list[LinhaAvanço] = []
    total_previsto = 0.0
    total_inspecionado = 0.0
    total_aprovado = 0.0
    total_reprovado = 0.0

    for l in linhas:
        a = agregado[l["id"]]
        previsto = a["quantidade_prevista"]
        inspecionado = a["quantidade_inspecionada"]
        aprovado = a["quantidade_aprovada"]
        reprovado = a["quantidade_reprovada"]

        av_aprovado = (aprovado / previsto * 100) if previsto > 0 else 0.0
        av_inspecionado = (inspecionado / previsto * 100) if previsto > 0 else 0.0
        excesso = av_aprovado > 100 or av_inspecionado > 100

        linhas_avanco.append(LinhaAvanço(
            linha_id=a["linha_id"],
            metodo=a["metodo"],
            unidade=a["unidade"],
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

    # ---------- Curva S: previsto vs realizado ao longo do tempo ----------
    # Distribuição linear do previsto sobre as últimas N semanas
    dt_inicial, dt_final = _ultimas_4_semanas()
    semanas = _semanas_entre(dt_inicial, dt_final)

    # Busca laudos emitidos com issued_at para curva S e previsão
    aprovado_por_semana: dict[str, float] = {}
    for v in vinculos_emitidos:
        laudo_id = v["laudo_id"]
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue
        issued_at = laudo.get("issued_at")
        if not issued_at:
            continue
        try:
            dt_issued = datetime.fromisoformat(issued_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            continue
        if dt_inicial <= dt_issued <= dt_final:
            semana = _semana_iso(dt_issued)
            if semana:
                aprovado_por_semana[semana] = aprovado_por_semana.get(semana, 0.0) + float(v.get("quantidade_aprovada") or 0)

    # Constrói pontos da curva S
    pontos_curva_s: list[PontoCurvaS] = []
    acumulado_realizado = 0.0
    for i in range(semanas):
        semana_idx = semanas - 1 - i  # mais recente primeiro
        dt_semana = dt_final - timedelta(weeks=semanas - 1 - i)
        semana_str = _semana_iso(dt_semana)
        # Previsto acumulado (distribuição linear)
        prevista_acumulada = total_previsto * (semanas - i) / semanas if semanas > 0 else 0.0
        # Realizado acumulado (soma de aprovado até esta semana)
        acumulado_realizado += aprovado_por_semana.get(semana_str, 0.0)
        pontos_curva_s.append(PontoCurvaS(
            semana=semana_str,
            previsto=round(prevista_acumulada, 2),
            realizado=round(acumulado_realizado, 2),
        ))
    pontos_curva_s.reverse()  # ordem cronológica

    # ---------- Rosca: aprovação, reprovado, saldo ----------
    total_aprovado_rosca = total_aprovado
    total_reprovado_rosca = total_reprovado
    saldo_execucao = max(0, total_previsto - total_aprovado - total_reprovado)
    total_escopo = total_previsto

    fatias: list[FatiaRosca] = []
    if total_previsto > 0:
        fatias.append(FatiaRosca(categoria="Aprovado", valor=round(total_aprovado, 2), percentual=round(total_aprovado / total_previsto * 100, 1)))
        fatias.append(FatiaRosca(categoria="Reprovado (retrabalho)", valor=round(total_reprovado, 2), percentual=round(total_reprovado / total_previsto * 100, 1)))
        fatias.append(FatiaRosca(categoria="Saldo a executar", valor=round(saldo_execucao, 2), percentual=round(saldo_execucao / total_previsto * 100, 1)))

    rosca = Rosca(fatias=fatias, total=total_previsto)

    # ---------- Retrabalho e prazo por método ----------
    metodos_dict: dict[str, dict] = {}
    for v in vinculos_emitidos:
        laudo_id = v["laudo_id"]
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue
        linha_id = v["linha_id"]
        linha = next((l for l in linhas if l["id"] == linha_id), None)
        if not linha:
            continue
        metodo = laudo.get("method") or linha["method"]
        if metodo not in metodos_dict:
            metodos_dict[metodo] = {"total": 0, "devolvidos": 0, "dias_prazo": [], "count_prazo": 0}
        metodos_dict[metodo]["total"] += 1
        if laudo.get("status") == "reprovado":
            metodos_dict[metodo]["devolvidos"] += 1
        issued_at = laudo.get("issued_at")
        date_emissao = laudo.get("date")
        if issued_at and date_emissao:
            try:
                dt_issued = datetime.fromisoformat(issued_at.replace("Z", "+00:00")).replace(tzinfo=None)
                dt_date = datetime.fromisoformat(date_emissao)
                dias = (dt_issued - dt_date).days
                metodos_dict[metodo]["dias_prazo"].append(dias)
                metodos_dict[metodo]["count_prazo"] += 1
            except Exception:
                pass

    retrabalho_por_metodo: list[RetrabalhoMetodo] = []
    for metodo, dados in metodos_dict.items():
        total = dados["total"]
        devolvidos = dados["devolvidos"]
        percentual = (devolvidos / total * 100) if total > 0 else 0.0
        prazo_medio = (sum(dados["dias_prazo"]) / len(dados["dias_prazo"])) if dados["dias_prazo"] else None
        retrabalho_por_metodo.append(RetrabalhoMetodo(
            metodo=metodo,
            total_laudos=total,
            devolvidos=devolvidos,
            percentual_retrabalho=round(percentual, 1),
            prazo_medio_dias=round(prazo_medio, 1) if prazo_medio is not None else None,
        ))

    # ---------- Produção por inspetor ----------
    producao_por_inspetor_dict: dict[str, dict] = {}
    for v in vinculos_emitidos:
        laudo_id = v["laudo_id"]
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue
        inspetor_id = laudo.get("inspector_id") or laudo.get("inspector_name") or "desconhecido"
        inspetor_nome = laudo.get("inspector_name") or inspetor_id
        if inspetor_id not in producao_por_inspetor_dict:
            producao_por_inspetor_dict[inspetor_id] = {
                "inspetor_id": inspetor_id,
                "inspetor_nome": inspetor_nome,
                "quantidade_aprovada": 0.0,
                "quantidade_reprovada": 0.0,
                "unidade": "",
            }
        linha_id = v["linha_id"]
        linha = next((l for l in linhas if l["id"] == linha_id), None)
        if linha:
            producao_por_inspetor_dict[inspetor_id]["unidade"] = linha["unidade"]
        producao_por_inspetor_dict[inspetor_id]["quantidade_aprovada"] += float(v.get("quantidade_aprovada") or 0)
        producao_por_inspetor_dict[inspetor_id]["quantidade_reprovada"] += float(v.get("quantidade_reprovada") or 0)

    producao_por_inspetor_list: list[ProducaoInspetor] = [
        ProducaoInspetor(
            inspetor_id=d["inspetor_id"],
            inspetor_nome=d["inspetor_nome"],
            quantidade_aprovada=round(d["quantidade_aprovada"], 2),
            quantidade_reprovada=round(d["quantidade_reprovada"], 2),
            unidade=d["unidade"],
        )
        for d in producao_por_inspetor_dict.values()
    ]

    # ---------- Pendências: laudos em 'enviado' há mais de 3 dias ----------
    dt_limite_pendencia = datetime.utcnow() - timedelta(days=3)
    pendencias: list[PendenciaLaudo] = []
    for v in vinculos_emitidos:
        laudo_id = v["laudo_id"]
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue
        if laudo.get("status") != "enviado":
            continue
        created_at = laudo.get("created_at")
        if not created_at:
            continue
        try:
            dt_criado = datetime.fromisoformat(created_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            continue
        dias_parado = (datetime.utcnow() - dt_criado).days
        if dias_parado > 3:
            pendencias.append(PendenciaLaudo(
                laudo_id=laudo_id,
                laudo_codigo=laudo.get("code", laudo_id),
                metodo=laudo.get("method", ""),
                inspetor_nome=laudo.get("inspector_name", "—"),
                dias_parado=dias_parado,
                status=laudo.get("status", ""),
            ))

    pendencias.sort(key=lambda p: p.dias_parado, reverse=True)

    # ---------- Previsão de término ----------
    aprovado_4semanas = 0.0
    for v in vinculos_emitidos:
        laudo_id = v["laudo_id"]
        laudo = laudos_mais_recentes.get(laudo_id)
        if not laudo:
            continue
        issued_at = laudo.get("issued_at")
        if not issued_at:
            continue
        try:
            dt_issued = datetime.fromisoformat(issued_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            continue
        if dt_inicial <= dt_issued <= dt_final:
            aprovado_4semanas += float(v.get("quantidade_aprovada") or 0)

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
        curva_s=CurvaS(pontos=pontos_curva_s),
        rosca=Rosca(fatias=fatias, total=total_previsto),
        retrabalho_por_metodo=retrabalho_por_metodo,
        producao_por_inspetor=producao_por_inspetor_list,
        pendencias=pendencias,
        previsao=Previsão(
            obra_id=obra_id,
            saldo_restante=round(saldo_restante, 2),
            ritmo_medio_semanal=round(ritmo_medio_semanal, 2) if ritmo_medio_semanal else None,
            semanas_estimadas=round(semanas_estimadas, 1) if semanas_estimadas else None,
            dados_insuficientes=dados_insuficientes,
            data_estimada=data_estimada,
        ),
    )


def _vazio(obra_id: str, obra_nome: str, metodo: str | None) -> AvanceObraResponse:
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
        curva_s=CurvaS(pontos=[]),
        rosca=Rosca(fatias=[], total=0),
        retrabalho_por_metodo=[],
        producao_por_inspetor=[],
        pendencias=[],
        previsao=Previsão(
            obra_id=obra_id,
            saldo_restante=0,
            ritmo_medio_semanal=None,
            semanas_estimadas=None,
            dados_insuficientes=True,
        ),
    )


def _sem_vinculos(linhas: list[dict]) -> AvanceObraResponse:
    linhas_avanco: list[LinhaAvanço] = []
    total_previsto = 0.0
    for l in linhas:
        previsto = float(l["quantidade_prevista"])
        linhas_avanco.append(LinhaAvanço(
            linha_id=l["id"],
            metodo=l["method"],
            unidade=l["unidade"],
            quantidade_prevista=previsto,
            quantidade_inspecionada=0.0,
            quantidade_aprovada=0.0,
            quantidade_reprovada=0.0,
            avancao_aprovado_pct=0.0,
            avancao_inspecionado_pct=0.0,
            excesso_escopo=False,
        ))
        total_previsto += previsto
    return AvanceObraResponse(
        resumo=ResumoObra(
            obra_id=linhas[0].get("site_id", ""),
            obra_nome="",
            total_previsto=total_previsto,
            total_inspecionado=0,
            total_aprovado=0,
            total_reprovado=0,
            avancao_aprovado_pct=0,
            avancao_inspecionado_pct=0,
            excesso_escopo=False,
            data_atualizacao=datetime.utcnow().isoformat(),
            metodo=None,
        ),
        linhas=linhas_avanco,
        curva_s=CurvaS(pontos=[]),
        rosca=Rosca(fatias=[], total=0),
        retrabalho_por_metodo=[],
        producao_por_inspetor=[],
        pendencias=[],
        previsao=Previsão(
            obra_id=linhas[0].get("site_id", ""),
            saldo_restante=total_previsto,
            ritmo_medio_semanal=None,
            semanas_estimadas=None,
            dados_insuficientes=True,
        ),
    )
