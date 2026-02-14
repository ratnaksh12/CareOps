from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import InventoryItem, User
from app.schemas import InventoryItemCreate, InventoryItemUpdate, InventoryItemOut
from app.security import get_current_user

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=list[InventoryItemOut])
async def list_items(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.workspace_id == user.workspace_id)
        .order_by(InventoryItem.name)
    )
    return [InventoryItemOut.model_validate(i) for i in result.scalars().all()]


@router.post("", response_model=InventoryItemOut)
async def create_item(
    data: InventoryItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    item = InventoryItem(workspace_id=user.workspace_id, **data.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return InventoryItemOut.model_validate(item)

@router.get("/{item_id}", response_model=InventoryItemOut)
async def get_item(
    item_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.workspace_id == user.workspace_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return InventoryItemOut.model_validate(item)


@router.patch("/{item_id}", response_model=InventoryItemOut)
async def update_item(
    item_id: str,
    data: InventoryItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.workspace_id == user.workspace_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(item, key, val)
    await db.flush()
    await db.refresh(item)
    return InventoryItemOut.model_validate(item)


@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.workspace_id == user.workspace_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    return {"ok": True}


@router.post("/{item_id}/deduct")
async def deduct_stock(
    item_id: str,
    quantity: int = 1,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.workspace_id == user.workspace_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.quantity < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    item.quantity -= quantity
    await db.flush()
    await db.refresh(item)
    return InventoryItemOut.model_validate(item)
