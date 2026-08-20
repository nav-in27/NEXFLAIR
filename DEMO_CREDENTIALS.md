# MEIKAAN — Demo & Test Credentials

> **Note**: These credentials correspond to local test seed accounts pre-populated by `start_project.py` / `demo_seeder.py` for evaluating role-based workflows during local demonstration. In production environments, authentication is managed via secure user registration, SMS OTP, and enterprise SSO.

---

## 👥 Pre-Configured Test Roles

| Role | Username / Email | Password | Intended Workflow |
| :--- | :--- | :--- | :--- |
| **Citizen** | *Public / Self-registration* | *N/A* | Submit new grievance with photo & GPS; track complaint lifecycle. |
| **Field Worker** | `worker@meikaan.gov` | `worker123` | View assigned ward tasks, capture camera/upload evidence, run verification. |
| **Municipal Reviewer** | `reviewer@meikaan.gov` | `reviewer123` | Inspect borderline/uncertain cases via forensic split-view slider; resolve audit queue. |
| **Administrator** | `admin@meikaan.gov` | `admin123` | Oversee city-wide civic metrics, manage ward assignments, monitor system health. |

---

## 🔄 Re-seeding Test Accounts

To reset the local database and re-seed clean demo records:

```bash
python start_project.py
```
Or run the backend seeder directly:
```bash
cd backend
python -c "from app.db.session import SessionLocal; from app.services.demo_seeder import seed_demo_data; db=SessionLocal(); seed_demo_data(db); db.close()"
```
