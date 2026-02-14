from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.database import get_db
from app.models import Form, FormSubmission, Contact, User, FormSubmissionStatus
from app.schemas import (
    FormCreate, FormUpdate, FormOut,
    FormSubmissionCreate, FormSubmissionUpdate, FormSubmissionOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/forms", tags=["Forms"])


@router.get("", response_model=list[FormOut])
async def list_forms(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    result = await db.execute(
        select(Form).where(Form.workspace_id == user.workspace_id).order_by(Form.created_at.desc())
    )
    return [FormOut.model_validate(f) for f in result.scalars().all()]


@router.post("", response_model=FormOut)
async def create_form(
    data: FormCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    form = Form(
        workspace_id=user.workspace_id,
        name=data.name,
        description=data.description,
        fields=[f.model_dump() for f in data.fields],
    )
    db.add(form)
    await db.flush()
    await db.refresh(form)
    return FormOut.model_validate(form)


@router.patch("/{form_id}", response_model=FormOut)
async def update_form(
    form_id: str,
    data: FormUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Form).where(Form.id == form_id, Form.workspace_id == user.workspace_id)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    update_data = data.model_dump(exclude_unset=True)
    if "fields" in update_data and update_data["fields"] is not None:
        update_data["fields"] = [f if isinstance(f, dict) else f.model_dump() for f in update_data["fields"]]
    for key, val in update_data.items():
        setattr(form, key, val)
    await db.flush()
    await db.refresh(form)
    return FormOut.model_validate(form)


@router.delete("/{form_id}")
async def delete_form(
    form_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Form).where(Form.id == form_id, Form.workspace_id == user.workspace_id)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    await db.delete(form)
    return {"ok": True}


# ============ Submissions ============

@router.get("/{form_id}/submissions", response_model=list[FormSubmissionOut])
async def list_submissions(
    form_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FormSubmission)
        .options(selectinload(FormSubmission.contact))
        .where(FormSubmission.form_id == form_id)
        .order_by(FormSubmission.created_at.desc())
    )
    return [FormSubmissionOut.model_validate(s) for s in result.scalars().all()]


@router.post("/submissions", response_model=FormSubmissionOut)
async def create_submission(
    data: FormSubmissionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub = FormSubmission(**data.model_dump())
    db.add(sub)
    await db.flush()
    result = await db.execute(
        select(FormSubmission)
        .options(selectinload(FormSubmission.contact))
        .where(FormSubmission.id == sub.id)
    )
    sub = result.scalar_one()
    return FormSubmissionOut.model_validate(sub)


@router.patch("/submissions/{submission_id}", response_model=FormSubmissionOut)
async def update_submission(
    submission_id: str,
    data: FormSubmissionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FormSubmission).where(FormSubmission.id == submission_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = FormSubmissionStatus(update_data["status"])
    for key, val in update_data.items():
        setattr(sub, key, val)
    await db.flush()
    result = await db.execute(
        select(FormSubmission)
        .options(selectinload(FormSubmission.contact))
        .where(FormSubmission.id == submission_id)
    )
    sub = result.scalar_one()
    return FormSubmissionOut.model_validate(sub)


# ============ Public Endpoints ============

@router.get("/{form_id}/public", response_model=FormOut)
async def get_public_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Form).where(Form.id == form_id))
    form = result.scalar_one_or_none()
    if not form or not form.is_active:
        raise HTTPException(status_code=404, detail="Form not found")
    return FormOut.model_validate(form)


@router.post("/{form_id}/submit", response_model=FormSubmissionOut)
async def submit_public_form(
    form_id: str,
    data: dict,  # Raw form data
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify form exists
    result = await db.execute(select(Form).where(Form.id == form_id))
    form = result.scalar_one_or_none()
    if not form or not form.is_active:
        raise HTTPException(status_code=404, detail="Form not found")

    # 2. Extract contact info
    email = data.get("email") or data.get("Email")
    phone = data.get("phone") or data.get("Phone")
    name = data.get("name") or data.get("Name") or data.get("Full Name") or "Anonymous"

    contact = None
    if email or phone:
        # Try to find existing contact
        query = select(Contact).where(Contact.workspace_id == form.workspace_id)
        conditions = []
        if email:
            conditions.append(Contact.email == email)
        if phone:
            conditions.append(Contact.phone == phone)
        
        # Simple OR Logic for now (if either matches)
        # For precision, strict matching on email is better
        if email:
            contact_result = await db.execute(query.where(Contact.email == email))
            contact = contact_result.scalar_one_or_none()
        
        if not contact and phone:
            contact_result = await db.execute(query.where(Contact.phone == phone))
            contact = contact_result.scalar_one_or_none()

    # 3. Create contact if not found
    if not contact:
        contact = Contact(
            workspace_id=form.workspace_id,
            name=name,
            email=email,
            phone=phone,
            source="form_submission",
        )
        db.add(contact)
        await db.flush()

    # 4. Create submission
    sub = FormSubmission(
        form_id=form.id,
        contact_id=contact.id,
        data=data,
        status=FormSubmissionStatus.PENDING,
    )
    db.add(sub)
    await db.flush()

    # Return with contact loaded
    result = await db.execute(
        select(FormSubmission)
        .options(selectinload(FormSubmission.contact))
        .where(FormSubmission.id == sub.id)
    )
    sub = result.scalar_one()
    return FormSubmissionOut.model_validate(sub)
