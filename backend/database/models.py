import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dsc_signing.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Officer(Base):
    __tablename__ = "officers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    pin_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    certificates = relationship("Certificate", back_populates="officer", cascade="all, delete-orphan")
    signing_histories = relationship("SigningHistory", back_populates="officer", cascade="all, delete-orphan")
    dongle_sessions = relationship("DongleSession", back_populates="officer", cascade="all, delete-orphan")

class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=False)
    serial_number = Column(String, unique=True, index=True, nullable=False)
    common_name = Column(String, nullable=False)
    organization = Column(String, nullable=False)
    issued_by = Column(String, nullable=False)
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=False)
    public_key = Column(Text, nullable=False)
    private_key = Column(Text, nullable=False)  # Encrypted/Plain private key for simulated signing
    is_active = Column(Boolean, default=True)

    officer = relationship("Officer", back_populates="certificates")

class SigningHistory(Base):
    __tablename__ = "signing_history"

    id = Column(Integer, primary_key=True, index=True)
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=False)
    officer_name = Column(String, nullable=False)
    document_name = Column(String, nullable=False)
    document_type = Column(String, nullable=False)  # 'PDF' or 'Text'
    document_size = Column(Integer, nullable=False)  # in bytes
    signed_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False)  # 'Success' or 'Failed'
    signature_id = Column(String, nullable=True)  # UUID or cryptographic hash
    error_message = Column(String, nullable=True)

    officer = relationship("Officer", back_populates="signing_histories")

class DongleSession(Base):
    __tablename__ = "dongle_sessions"

    id = Column(Integer, primary_key=True, index=True)
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=False)
    connected_at = Column(DateTime, default=datetime.utcnow)
    disconnected_at = Column(DateTime, nullable=True)
    dongle_id = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    officer = relationship("Officer", back_populates="dongle_sessions")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
