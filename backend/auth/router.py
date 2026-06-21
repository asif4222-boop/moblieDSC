import os
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
import hashlib

from database.models import get_db, Officer, Certificate
from signing.certificate import generate_dsc_certificate

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Cryptographic Salt for PIN Hashing
SALT = "indiagovhackathonsecurepasswordsalt2026"

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretjwtkeyforindiagovhackathon2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

class OfficerRegister(BaseModel):
    name: str
    email: str
    department: str
    designation: str
    pin: str

class OfficerLogin(BaseModel):
    email: str
    pin: str

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    return get_pin_hash(plain_pin) == hashed_pin

def get_pin_hash(pin: str) -> str:
    return hashlib.sha256((pin + SALT).encode('utf-8')).hexdigest()

# Compatibility wrapper for existing imports in other modules
class MockPwdContext:
    def verify(self, plain: str, hashed: str) -> bool:
        return verify_pin(plain, hashed)
    def hash(self, secret: str) -> str:
        return get_pin_hash(secret)

pwd_context = MockPwdContext()

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Dependency to get current authenticated officer
def get_current_officer(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token credentials",
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
        
    officer = db.query(Officer).filter(Officer.email == email).first()
    if officer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Officer not found",
        )
    if not officer.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive officer account",
        )
    return officer

@router.post("/register")
def register_officer(payload: OfficerRegister, db: Session = Depends(get_db)):
    # Check if officer exists
    existing = db.query(Officer).filter(Officer.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An officer with this email is already registered."
        )

    # 1. Create officer
    new_officer = Officer(
        name=payload.name,
        email=payload.email,
        department=payload.department,
        designation=payload.designation,
        pin_hash=get_pin_hash(payload.pin),
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_officer)
    db.commit()
    db.refresh(new_officer)

    # 2. Generate simulated X.509 DSC certificate
    cert_data = generate_dsc_certificate(new_officer.name, new_officer.department)
    new_cert = Certificate(
        officer_id=new_officer.id,
        serial_number=cert_data["serial_number"],
        common_name=cert_data["common_name"],
        organization=cert_data["organization"],
        issued_by=cert_data["issued_by"],
        valid_from=cert_data["valid_from"],
        valid_until=cert_data["valid_until"],
        public_key=cert_data["public_key"],
        private_key=cert_data["private_key"],
        is_active=True
    )
    db.add(new_cert)
    db.commit()

    return {
        "success": True,
        "message": f"Officer {new_officer.name} registered successfully and DSC certificate issued.",
        "officer": {
            "id": new_officer.id,
            "name": new_officer.name,
            "email": new_officer.email,
            "department": new_officer.department,
            "designation": new_officer.designation,
        }
    }

@router.post("/login")
def login_officer(payload: OfficerLogin, db: Session = Depends(get_db)):
    officer = db.query(Officer).filter(Officer.email == payload.email).first()
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or PIN"
        )
    
    if not verify_pin(payload.pin, officer.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or PIN"
        )

    # Update last login
    officer.last_login = datetime.utcnow()
    db.commit()

    # Generate token
    access_token = create_access_token(data={"sub": officer.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "officer": {
            "id": officer.id,
            "name": officer.name,
            "email": officer.email,
            "department": officer.department,
            "designation": officer.designation,
        }
    }

class ChangePinRequest(BaseModel):
    current_pin: str
    new_pin: str

@router.post("/change-pin")
def change_pin(
    payload: ChangePinRequest,
    current_officer: Officer = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Allows the officer to securely update their token security PIN.
    """
    if not verify_pin(payload.current_pin, current_officer.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current PIN is incorrect."
        )

    if len(payload.new_pin) < 4 or not payload.new_pin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New PIN must be exactly 4 numeric digits."
        )

    current_officer.pin_hash = get_pin_hash(payload.new_pin)
    db.commit()

    return {
        "success": True,
        "message": "Token security PIN updated successfully!"
    }
