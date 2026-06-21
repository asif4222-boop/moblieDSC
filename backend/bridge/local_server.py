import os
import sys
import uuid
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Response, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Adjust path to import backend modules from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.models import get_db, Officer, Certificate, DongleSession, SigningHistory
from auth.router import SECRET_KEY, ALGORITHM, pwd_context
from signing.pdf_signer import sign_pdf_file, sign_pdf_file_async
from signing.text_signer import sign_text_content
import jwt

app = FastAPI(title="DSC Mobile Bridge Server (Port 7777)", version="1.0.0")

# Allow CORS for all origins to support arbitrary WebViews
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BridgeSignRequest(BaseModel):
    document_id: str = "doc-12345"
    document_name: str = "Land_Allotment_AP_REV_2026_09.pdf"
    content_hash: str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    callback_url: str = "https://revenue.ap.gov.in/api/callback"

# Simulated in-memory unlock state (maps officer_id to bool)
unlocked_sessions = {}

class ConnectRequest(BaseModel):
    dongle_id: str = "DSC-USB-TYPEC-998"

class UnlockRequest(BaseModel):
    pin: str

class TextSignRequest(BaseModel):
    text: str

def get_current_officer_from_token(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization token in bridge request"
        )
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Authentication failed")

    officer = db.query(Officer).filter(Officer.email == email).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    return officer

@app.get("/api/dongle/status")
def get_dongle_status(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Check if the dongle is connected and unlocked for the current officer.
    """
    if not authorization:
        return {"connected": False, "unlocked": False, "message": "No session authorization provided."}
        
    try:
        officer = get_current_officer_from_token(authorization, db)
    except Exception:
        return {"connected": False, "unlocked": False, "message": "Invalid credentials."}

    # Query DB for active session
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == officer.id,
        DongleSession.is_active == True
    ).first()

    if not session:
        return {
            "connected": False,
            "unlocked": False,
            "dongle_id": None,
            "officer_name": officer.name,
            "message": "USB Type-C DSC Dongle not connected"
        }

    is_unlocked = unlocked_sessions.get(officer.id, False)
    return {
        "connected": True,
        "unlocked": is_unlocked,
        "dongle_id": session.dongle_id,
        "officer_name": officer.name,
        "message": "Dongle connected and unlocked" if is_unlocked else "Dongle connected, PIN verification required"
    }

@app.post("/api/dongle/connect")
def connect_dongle(
    payload: ConnectRequest,
    current_officer: Officer = Depends(get_current_officer_from_token),
    db: Session = Depends(get_db)
):
    """
    Simulate plugging in the USB Type-C DSC dongle.
    """
    # Deactivate any existing sessions for this officer
    active_sessions = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).all()
    for s in active_sessions:
        s.is_active = False
        s.disconnected_at = datetime.utcnow()

    # Create new session
    session = DongleSession(
        officer_id=current_officer.id,
        dongle_id=payload.dongle_id,
        connected_at=datetime.utcnow(),
        is_active=True
    )
    db.add(session)
    db.commit()

    # Clear unlock state for this officer on reconnect
    unlocked_sessions[current_officer.id] = False

    return {
        "success": True,
        "connected": True,
        "unlocked": False,
        "dongle_id": session.dongle_id,
        "message": "USB Type-C DSC Dongle inserted. Ready for PIN entry."
    }

@app.post("/api/dongle/unlock")
def unlock_dongle(
    payload: UnlockRequest,
    current_officer: Officer = Depends(get_current_officer_from_token),
    db: Session = Depends(get_db)
):
    """
    Unlock the connected dongle using the officer's PIN.
    """
    # Check if dongle is connected
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).first()

    if not session:
        raise HTTPException(
            status_code=400,
            detail="DSC Dongle not connected. Cannot unlock."
        )

    # Verify PIN
    if not pwd_context.verify(payload.pin, current_officer.pin_hash):
        unlocked_sessions[current_officer.id] = False
        raise HTTPException(
            status_code=401,
            detail="Invalid PIN code. Access denied."
        )

    unlocked_sessions[current_officer.id] = True
    return {
        "success": True,
        "connected": True,
        "unlocked": True,
        "message": "DSC Dongle successfully unlocked. Cryptographic signing key loaded."
    }

@app.post("/api/dongle/disconnect")
def disconnect_dongle(
    current_officer: Officer = Depends(get_current_officer_from_token),
    db: Session = Depends(get_db)
):
    """
    Simulate unplugging the USB Type-C DSC dongle.
    """
    sessions = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).all()

    for s in sessions:
        s.is_active = False
        s.disconnected_at = datetime.utcnow()
    
    db.commit()

    # Clear unlock status
    unlocked_sessions[current_officer.id] = False

    return {
        "success": True,
        "connected": False,
        "unlocked": False,
        "message": "USB Type-C DSC Dongle unplugged."
    }

@app.get("/api/certificate/info")
def get_certificate_info(
    current_officer: Officer = Depends(get_current_officer_from_token),
    db: Session = Depends(get_db)
):
    """
    Retrieve certificate info from the unlocked dongle.
    """
    # Verify connected
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).first()

    if not session:
        raise HTTPException(status_code=400, detail="Dongle not connected")
        
    # Verify unlocked
    if not unlocked_sessions.get(current_officer.id, False):
        raise HTTPException(status_code=400, detail="Dongle is locked. Enter PIN first.")

    cert = db.query(Certificate).filter(
        Certificate.officer_id == current_officer.id,
        Certificate.is_active == True
    ).first()

    if not cert:
        raise HTTPException(status_code=444, detail="No certificate found on dongle")

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

@app.post("/api/sign/pdf")
async def sign_pdf_endpoint(
    file: UploadFile = File(...),
    reason: str = Form("Government DSC Mobile Signing"),
    current_officer: Officer = Depends(get_current_officer_from_token),
    db: Session = Depends(get_db)
):
    """
    Sign uploaded PDF on the local bridge.
    """
    # Check connected
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).first()

    if not session:
        raise HTTPException(status_code=400, detail="DSC Dongle not connected")

    # Check unlocked
    if not unlocked_sessions.get(current_officer.id, False):
        raise HTTPException(status_code=400, detail="DSC Dongle locked. Verification required.")

    cert = db.query(Certificate).filter(
        Certificate.officer_id == current_officer.id,
        Certificate.is_active == True
    ).first()

    if not cert:
        raise HTTPException(status_code=404, detail="Active certificate not found.")

    pdf_bytes = await file.read()
    doc_size = len(pdf_bytes)
    doc_name = file.filename or "document.pdf"

    try:
        signed_bytes = await sign_pdf_file_async(
            pdf_bytes=pdf_bytes,
            cert_pem=cert.public_key,
            key_pem=cert.private_key,
            reason=reason
        )

        signature_id = str(uuid.uuid4())

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

        return Response(
            content=signed_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=signed_{doc_name}",
                "X-Signature-ID": signature_id
            }
        )

    except Exception as e:
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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sign/text")
def sign_text_endpoint(
    payload: TextSignRequest,
    current_officer: Officer = Depends(get_current_officer_from_token),
    db: Session = Depends(get_db)
):
    """
    Sign plain text on the local bridge.
    """
    # Check connected
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).first()

    if not session:
        raise HTTPException(status_code=400, detail="DSC Dongle not connected")

    # Check unlocked
    if not unlocked_sessions.get(current_officer.id, False):
        raise HTTPException(status_code=400, detail="DSC Dongle locked")

    cert = db.query(Certificate).filter(
        Certificate.officer_id == current_officer.id,
        Certificate.is_active == True
    ).first()

    if not cert:
        raise HTTPException(status_code=404, detail="Active certificate not found.")

    text_data = payload.text
    doc_size = len(text_data.encode("utf-8"))

    try:
        sig_b64 = sign_text_content(text_data, cert.private_key)
        signature_id = str(uuid.uuid4())

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
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/bridge/status")
def get_bridge_status_public(db: Session = Depends(get_db)):
    """
    Get the overall status of the local bridge and connection info.
    """
    # Check if any dongle is connected
    active_session = db.query(DongleSession).filter(
        DongleSession.is_active == True
    ).first()
    
    dongle_connected = active_session is not None
    unlocked = False
    officer_name = None
    
    if active_session:
        unlocked = unlocked_sessions.get(active_session.officer_id, False)
        officer = db.query(Officer).filter(Officer.id == active_session.officer_id).first()
        if officer:
            officer_name = officer.name

    return {
        "status": "online",
        "version": "1.0.0",
        "dongle_connected": dongle_connected,
        "dongle_unlocked": unlocked,
        "dongle_id": active_session.dongle_id if active_session else None,
        "active_officer": officer_name,
        "message": "DSC Bridge Server is active."
    }

@app.post("/bridge/sign")
def bridge_sign_request(payload: BridgeSignRequest, db: Session = Depends(get_db)):
    """
    Intercept signing requests from any WebView or government portal.
    Checks if a dongle is connected and returns a pending signing request.
    """
    # 1. Check if dongle is connected
    active_session = db.query(DongleSession).filter(
        DongleSession.is_active == True
    ).first()
    
    if not active_session:
        raise HTTPException(
            status_code=400,
            detail="DSC USB Type-C dongle is not connected. Please connect the dongle to proceed."
        )
    
    # 2. Return a signing request payload
    signing_request_id = f"sig-req-{uuid.uuid4().hex[:8]}"
    
    return {
        "status": "pending_verification",
        "signing_request_id": signing_request_id,
        "document_name": payload.document_name,
        "content_hash": payload.content_hash,
        "callback_url": payload.callback_url,
        "dongle_id": active_session.dongle_id,
        "officer_id": active_session.officer_id,
        "message": "Signing request intercepted. Please complete PIN verification in the main application."
    }
