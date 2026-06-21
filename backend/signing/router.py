import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.models import get_db, Certificate, SigningHistory, DongleSession
from auth.router import get_current_officer, Officer
from signing.pdf_signer import sign_pdf_file, verify_pdf_signature, sign_pdf_file_async
from signing.text_signer import sign_text_content, verify_text_signature, get_subject_from_cert

router = APIRouter(prefix="", tags=["signing"])


class TextSignRequest(BaseModel):
    text: str

class TextVerifyRequest(BaseModel):
    text: str
    signature: str
    certificate_pem: str

def check_dongle_active(officer_id: int, db: Session):
    """
    Checks if the officer has an active, unlocked dongle session.
    """
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == officer_id,
        DongleSession.is_active == True
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DSC Dongle not connected. Please connect the USB Type-C dongle first."
        )
    return session

@router.get("/api/certificate/info")
def get_certificate_info(
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Retrieves the DSC certificate details from the active dongle session.
    """
    # Verify dongle is connected
    check_dongle_active(current_officer.id, db)

    # Get active certificate
    cert = db.query(Certificate).filter(
        Certificate.officer_id == current_officer.id,
        Certificate.is_active == True
    ).first()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active DSC certificate found for this officer."
        )

    return {
        "serial_number": cert.serial_number,
        "common_name": cert.common_name,
        "organization": cert.organization,
        "issued_by": cert.issued_by,
        "valid_from": cert.valid_from.isoformat() if cert.valid_from else None,
        "valid_until": cert.valid_until.isoformat() if cert.valid_until else None,
        "algorithm": "RSA-2048 / SHA-256",
        "public_key": cert.public_key
    }

@router.post("/api/sign/pdf")
async def sign_pdf_endpoint(
    file: UploadFile = File(...),
    reason: str = Form("Government DSC Mobile Signing"),
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Upload a PDF document, sign it using the officer's DSC, and return the signed file.
    """
    # 1. Check dongle status
    check_dongle_active(current_officer.id, db)

    # 2. Get certificate
    cert = db.query(Certificate).filter(
        Certificate.officer_id == current_officer.id,
        Certificate.is_active == True
    ).first()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active certificate not found."
        )

    # 3. Read uploaded PDF
    pdf_bytes = await file.read()
    doc_size = len(pdf_bytes)
    doc_name = file.filename or "document.pdf"

    try:
        # 4. Sign PDF using pyHanko
        signed_bytes = await sign_pdf_file_async(
            pdf_bytes=pdf_bytes,
            cert_pem=cert.public_key,
            key_pem=cert.private_key,
            reason=reason
        )

        signature_id = str(uuid.uuid4())

        # 5. Record success in history
        history = SigningHistory(
            officer_id=current_officer.id,
            officer_name=current_officer.name,
            document_name=doc_name,
            document_type="PDF",
            document_size=doc_size,
            signed_at=datetime.utcnow(),
            status="Success",
            signature_id=signature_id
        )
        db.add(history)
        db.commit()

        # 6. Return the signed PDF file
        return Response(
            content=signed_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=signed_{doc_name}",
                "X-Signature-ID": signature_id
            }
        )

    except Exception as e:
        # Record failure in history
        history = SigningHistory(
            officer_id=current_officer.id,
            officer_name=current_officer.name,
            document_name=doc_name,
            document_type="PDF",
            document_size=doc_size,
            signed_at=datetime.utcnow(),
            status="Failed",
            error_message=str(e)
        )
        db.add(history)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sign PDF: {str(e)}"
        )

@router.post("/api/sign/text")
def sign_text_endpoint(
    payload: TextSignRequest,
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Accept text content, sign it using the officer's DSC, and return the base64 signature.
    """
    # 1. Check dongle status
    check_dongle_active(current_officer.id, db)

    # 2. Get certificate
    cert = db.query(Certificate).filter(
        Certificate.officer_id == current_officer.id,
        Certificate.is_active == True
    ).first()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active certificate not found."
        )

    text_data = payload.text
    doc_size = len(text_data.encode("utf-8"))

    try:
        # 3. Sign text
        sig_b64 = sign_text_content(text_data, cert.private_key)
        signature_id = str(uuid.uuid4())

        # 4. Record history
        history = SigningHistory(
            officer_id=current_officer.id,
            officer_name=current_officer.name,
            document_name="Plain Text Content",
            document_type="Text",
            document_size=doc_size,
            signed_at=datetime.utcnow(),
            status="Success",
            signature_id=signature_id
        )
        db.add(history)
        db.commit()

        return {
            "success": True,
            "signature": sig_b64,
            "signature_id": signature_id,
            "signed_by": current_officer.name
        }

    except Exception as e:
        history = SigningHistory(
            officer_id=current_officer.id,
            officer_name=current_officer.name,
            document_name="Plain Text Content",
            document_type="Text",
            document_size=doc_size,
            signed_at=datetime.utcnow(),
            status="Failed",
            error_message=str(e)
        )
        db.add(history)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sign text: {str(e)}"
        )

@router.post("/api/verify")
async def verify_signature_endpoint(
    file: UploadFile = File(None),
    text: str = Form(None),
    signature: str = Form(None),
    certificate_pem: str = Form(None)
):
    """
    Verifies a signature.
    - If a PDF file is uploaded, verifies the digital signature of the PDF file.
    - If text, signature, and certificate_pem are provided, verifies the text signature.
    """
    # 1. PDF File verification
    if file is not None:
        pdf_bytes = await file.read()
        result = verify_pdf_signature(pdf_bytes)
        return {
            "type": "PDF",
            "valid": result["valid"],
            "message": result["message"],
            "signer": result.get("signer", "Unknown")
        }

    # 2. Text verification
    elif text is not None and signature is not None and certificate_pem is not None:
        valid = verify_text_signature(text, signature, certificate_pem)
        signer_name = get_subject_from_cert(certificate_pem)
        return {
            "type": "Text",
            "valid": valid,
            "message": "Signature is valid and matches the certificate." if valid else "Signature verification failed. The signature does not match the content or certificate.",
            "signer": signer_name if valid else "Unknown"
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request. Provide either a PDF file OR a text, signature, and certificate_pem."
        )
