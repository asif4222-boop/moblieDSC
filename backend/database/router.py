from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database.models import get_db, SigningHistory
from auth.router import get_current_officer, Officer

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("")
def get_signing_history(
    document_type: str = Query(None, description="Filter by document type (PDF, Text)"),
    status: str = Query(None, description="Filter by status (Success, Failed)"),
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Retrieves the digital signing history for the currently logged-in officer.
    """
    query = db.query(SigningHistory).filter(SigningHistory.officer_id == current_officer.id)
    
    if document_type:
        query = query.filter(SigningHistory.document_type.ilike(document_type))
    if status:
        query = query.filter(SigningHistory.status.ilike(status))
        
    history_records = query.order_by(SigningHistory.signed_at.desc()).all()
    
    return [
        {
            "id": record.id,
            "officer_id": record.officer_id,
            "officer_name": record.officer_name,
            "document_name": record.document_name,
            "document_type": record.document_type,
            "document_size": record.document_size,
            "signed_at": record.signed_at.isoformat() if record.signed_at else None,
            "status": record.status,
            "signature_id": record.signature_id,
            "error_message": record.error_message
        }
        for record in history_records
    ]
