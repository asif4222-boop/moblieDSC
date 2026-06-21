import sys
import os
from datetime import datetime
# Adjust path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.models import Base, engine, SessionLocal, Officer, Certificate
from signing.certificate import generate_dsc_certificate
from auth.router import get_pin_hash

def init_database():
    print("Initializing SQLite Database...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Predefined list of sample officers
        sample_officers = [
            {
                "name": "Rajesh Kumar",
                "email": "rajesh.kumar@gov.in",
                "department": "Revenue Department",
                "designation": "Joint Secretary",
                "pin": "1234"
            },
            {
                "name": "Priya Sharma",
                "email": "priya.sharma@gov.in",
                "department": "Finance Department",
                "designation": "Director of Audits",
                "pin": "5678"
            },
            {
                "name": "Venkat Rao",
                "email": "venkat.rao@gov.in",
                "department": "Transport Department",
                "designation": "Deputy Commissioner",
                "pin": "9012"
            }
        ]

        for item in sample_officers:
            # Check if already exists
            exists = db.query(Officer).filter(Officer.email == item["email"]).first()
            if exists:
                print(f"Officer {item['email']} already exists. Skipping.")
                continue

            # Create Officer
            officer = Officer(
                name=item["name"],
                email=item["email"],
                department=item["department"],
                designation=item["designation"],
                pin_hash=get_pin_hash(item["pin"]),
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(officer)
            db.commit()
            db.refresh(officer)

            # Generate Certificate for Officer
            print(f"Generating simulated Class-3 DSC Certificate for {officer.name}...")
            cert_data = generate_dsc_certificate(officer.name, officer.department)
            cert = Certificate(
                officer_id=officer.id,
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
            db.add(cert)
            db.commit()
            print(f"Successfully generated certificate serial {cert.serial_number} for {officer.name}.")

        print("Database initialization completed successfully!")
    except Exception as e:
        print(f"Error during DB initialization: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
