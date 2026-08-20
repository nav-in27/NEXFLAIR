import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.realpath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal, Base, engine
from app.models.entities import User, UserRole, Ward, Worker, Ticket, TicketStatus
from app.core.security import hash_password

def seed_phase_3_demo_data():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        ward_101 = db.query(Ward).filter(Ward.ward_number == 101).first()
        if not ward_101:
            ward_101 = Ward(ward_number=101, name="Central Civic District", zone="Central Zone")
            db.add(ward_101)
            
        ward_102 = db.query(Ward).filter(Ward.ward_number == 102).first()
        if not ward_102:
            ward_102 = Ward(ward_number=102, name="Northern Metro Zone", zone="North Zone")
            db.add(ward_102)
            
        db.commit()
        if ward_101: db.refresh(ward_101)
        if ward_102: db.refresh(ward_102)

        accounts = [
            {"email": "admin@meikaan.gov", "full_name": "System Administrator", "password": "Admin@123", "role": UserRole.ADMIN},
            {"email": "worker@meikaan.gov", "full_name": "Field Officer Rajesh Kumar", "password": "Worker@123", "role": UserRole.FIELD_WORKER},
            {"email": "reviewer@meikaan.gov", "full_name": "Civic Auditor Ananya Sharma", "password": "Reviewer@123", "role": UserRole.REVIEWER}
        ]

        user_objects = {}
        for acc in accounts:
            existing_user = db.query(User).filter(User.email == acc["email"]).first()
            if not existing_user:
                new_user = User(
                    email=acc["email"],
                    full_name=acc["full_name"],
                    hashed_password=hash_password(acc["password"]),
                    role=acc["role"],
                    is_active=True
                )
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                user_objects[acc["email"]] = new_user
            else:
                user_objects[acc["email"]] = existing_user

        worker_user = user_objects.get("worker@meikaan.gov")
        worker_rec = None
        if worker_user:
            worker_rec = db.query(Worker).filter(Worker.user_id == worker_user.id).first()
            if not worker_rec:
                worker_rec = Worker(
                    user_id=worker_user.id,
                    ward_id=ward_101.id if ward_101 else None,
                    worker_code="FW-101-01",
                    status="ACTIVE"
                )
                db.add(worker_rec)
                db.commit()
                db.refresh(worker_rec)

        print("Base system accounts and municipal wards verified.")
    except Exception as e:
        print(f"Error initializing system accounts: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_phase_3_demo_data()
