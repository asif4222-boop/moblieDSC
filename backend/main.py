import os
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database.models import get_db, Base, engine, Officer, DongleSession, Certificate
from auth.router import router as auth_router, get_current_officer, pwd_context
from database.router import router as history_router
from signing.router import router as signing_router
from database.init_db import init_database

# Auto-initialize database on startup if db file doesn't exist
db_path = "./dsc_signing.db"
if not os.path.exists(db_path):
    print("Database not found. Initializing database and creating tables...")
    init_database()

app = FastAPI(title="DSC Mobile Signing Solution Backend (Port 8000)", version="1.0.0")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:7777"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared in-memory unlocked status for endpoints hitting port 8000 directly
unlocked_sessions_main = {}

class ConnectRequest(BaseModel):
    dongle_id: str = "DSC-USB-TYPEC-998"

class UnlockRequest(BaseModel):
    pin: str

# Mount existing routers
app.include_router(auth_router)
app.include_router(history_router)
app.include_router(signing_router)

# Direct Dongle endpoints on main backend (satisfying API specs on 8000)
@app.get("/api/dongle/status")
def get_main_dongle_status(
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Check if the dongle is connected and unlocked for the officer.
    """
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).first()

    if not session:
        return {
            "connected": False,
            "unlocked": False,
            "dongle_id": None,
            "officer_name": current_officer.name,
            "message": "USB Type-C DSC Dongle not connected"
        }

    is_unlocked = unlocked_sessions_main.get(current_officer.id, False)
    return {
        "connected": True,
        "unlocked": is_unlocked,
        "dongle_id": session.dongle_id,
        "officer_name": current_officer.name,
        "message": "Dongle connected and unlocked" if is_unlocked else "Dongle connected, PIN verification required"
    }

@app.post("/api/dongle/connect")
def connect_main_dongle(
    payload: ConnectRequest,
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Simulate plugging in the USB Type-C DSC dongle.
    """
    active_sessions = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).all()
    for s in active_sessions:
        s.is_active = False
        s.disconnected_at = datetime.utcnow()

    session = DongleSession(
        officer_id=current_officer.id,
        dongle_id=payload.dongle_id,
        connected_at=datetime.utcnow(),
        is_active=True
    )
    db.add(session)
    db.commit()

    unlocked_sessions_main[current_officer.id] = False

    return {
        "success": True,
        "connected": True,
        "unlocked": False,
        "dongle_id": session.dongle_id,
        "message": "USB Type-C DSC Dongle inserted."
    }

@app.post("/api/dongle/unlock")
def unlock_main_dongle(
    payload: UnlockRequest,
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Unlock the connected dongle using the officer's PIN.
    """
    session = db.query(DongleSession).filter(
        DongleSession.officer_id == current_officer.id,
        DongleSession.is_active == True
    ).first()

    if not session:
        raise HTTPException(
            status_code=400,
            detail="DSC Dongle not connected. Cannot unlock."
        )

    if not pwd_context.verify(payload.pin, current_officer.pin_hash):
        unlocked_sessions_main[current_officer.id] = False
        raise HTTPException(
            status_code=401,
            detail="Invalid PIN code. Access denied."
        )

    unlocked_sessions_main[current_officer.id] = True
    return {
        "success": True,
        "connected": True,
        "unlocked": True,
        "message": "DSC Dongle successfully unlocked."
    }

@app.post("/api/dongle/disconnect")
def disconnect_main_dongle(
    current_officer: Officer = Depends(get_current_officer),
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

    unlocked_sessions_main[current_officer.id] = False

    return {
        "success": True,
        "connected": False,
        "unlocked": False,
        "message": "USB Type-C DSC Dongle unplugged."
    }

@app.get("/")
def read_root():
    return {
        "app": "DSC Mobile Signing Solution Main API Server",
        "status": "Running",
        "docs_url": "/docs"
    }
