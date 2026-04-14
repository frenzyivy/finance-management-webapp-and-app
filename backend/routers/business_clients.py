from fastapi import APIRouter, Depends, Query
from typing import Optional

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.business_client import BusinessClientCreate, BusinessClientUpdate, BusinessClientResponse

router = APIRouter(prefix="/business/clients", tags=["Business Clients"])


@router.get("", response_model=list[BusinessClientResponse])
async def list_clients(
    status: Optional[str] = Query(None, description="Filter by status"),
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("business_clients").select("*").eq("user_id", user_id).order("name")

    if status:
        query = query.eq("status", status)

    response = query.execute()
    return response.data


@router.get("/{client_id}", response_model=BusinessClientResponse)
async def get_client(
    client_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    response = sb.table("business_clients").select("*").eq("id", client_id).execute()

    if not response.data:
        raise NotFoundError("Business client")

    entry = response.data[0]
    if entry["user_id"] != user_id:
        raise ForbiddenError()

    return entry


@router.post("", response_model=BusinessClientResponse, status_code=201)
async def create_client(
    client: BusinessClientCreate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    data = client.model_dump(mode="json")
    data["user_id"] = user_id

    response = sb.table("business_clients").insert(data).execute()
    return response.data[0]


@router.put("/{client_id}", response_model=BusinessClientResponse)
async def update_client(
    client_id: str,
    client: BusinessClientUpdate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_clients").select("*").eq("id", client_id).execute()
    if not existing.data:
        raise NotFoundError("Business client")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = client.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("business_clients").update(update_data).eq("id", client_id).execute()
    return response.data[0]


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_clients").select("*").eq("id", client_id).execute()
    if not existing.data:
        raise NotFoundError("Business client")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    sb.table("business_clients").delete().eq("id", client_id).execute()
