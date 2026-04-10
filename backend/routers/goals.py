from fastapi import APIRouter, Depends

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.goal import (
    GoalCreate,
    GoalUpdate,
    GoalResponse,
    ContributionCreate,
    ContributionResponse,
)

router = APIRouter(prefix="/goals", tags=["Goals"])


@router.get("", response_model=list[GoalResponse])
async def list_goals(
    user_id: str = Depends(get_current_user),
):
    """List all savings goals for the current user."""
    sb = get_supabase()
    response = (
        sb.table("goals")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@router.post("", response_model=GoalResponse, status_code=201)
async def create_goal(
    goal: GoalCreate,
    user_id: str = Depends(get_current_user),
):
    """Create a new savings goal."""
    sb = get_supabase()
    data = goal.model_dump(mode="json")
    data["user_id"] = user_id
    data["status"] = "active"

    response = sb.table("goals").insert(data).execute()
    return response.data[0]


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: str,
    goal: GoalUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update an existing savings goal."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("goals").select("*").eq("id", goal_id).execute()
    if not existing.data:
        raise NotFoundError("Goal")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = goal.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("goals").update(update_data).eq("id", goal_id).execute()
    return response.data[0]


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    user_id: str = Depends(get_current_user),
):
    """Delete a savings goal and its contributions."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("goals").select("*").eq("id", goal_id).execute()
    if not existing.data:
        raise NotFoundError("Goal")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    # Delete contributions first, then the goal
    sb.table("goal_contributions").delete().eq("goal_id", goal_id).execute()
    sb.table("goals").delete().eq("id", goal_id).execute()


@router.post("/{goal_id}/contribute", response_model=ContributionResponse, status_code=201)
async def add_contribution(
    goal_id: str,
    contribution: ContributionCreate,
    user_id: str = Depends(get_current_user),
):
    """Add a contribution to a savings goal."""
    sb = get_supabase()

    # Verify goal ownership
    existing = sb.table("goals").select("*").eq("id", goal_id).execute()
    if not existing.data:
        raise NotFoundError("Goal")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    # Insert contribution
    data = contribution.model_dump(mode="json")
    data["goal_id"] = goal_id
    data["user_id"] = user_id

    response = sb.table("goal_contributions").insert(data).execute()

    # Update goal current_amount
    new_amount = existing.data[0]["current_amount"] + contribution.amount
    sb.table("goals").update({"current_amount": new_amount}).eq("id", goal_id).execute()

    # Mark as completed if target reached
    if new_amount >= existing.data[0]["target_amount"]:
        sb.table("goals").update({"status": "completed"}).eq("id", goal_id).execute()

    return response.data[0]


@router.get("/{goal_id}/contributions", response_model=list[ContributionResponse])
async def list_contributions(
    goal_id: str,
    user_id: str = Depends(get_current_user),
):
    """List all contributions for a savings goal."""
    sb = get_supabase()

    # Verify goal ownership
    existing = sb.table("goals").select("*").eq("id", goal_id).execute()
    if not existing.data:
        raise NotFoundError("Goal")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    response = (
        sb.table("goal_contributions")
        .select("*")
        .eq("goal_id", goal_id)
        .order("date", desc=True)
        .execute()
    )
    return response.data
