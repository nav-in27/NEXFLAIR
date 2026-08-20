from sqlalchemy import text
from app.db.session import engine

def migrate_db():
    print("Running database column migrations...")
    queries = [
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS accuracy_meters DOUBLE PRECISION;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location_source VARCHAR(50);",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location_status VARCHAR(50);",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ward_derived_from VARCHAR(50);",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS worker_start_latitude DOUBLE PRECISION;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS worker_start_longitude DOUBLE PRECISION;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS worker_start_accuracy DOUBLE PRECISION;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS worker_start_timestamp TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location_corrected_by VARCHAR(255);",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location_corrected_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location_correction_reason TEXT;",
        "ALTER TABLE ticket_evidence ADD COLUMN IF NOT EXISTS accuracy_meters DOUBLE PRECISION;",
        "ALTER TABLE ticket_evidence ADD COLUMN IF NOT EXISTS location_source VARCHAR(50);"
    ]

    for q in queries:
        with engine.begin() as conn:
            try:
                conn.execute(text(q))
                print(f"Executed: {q}")
            except Exception as e:
                print(f"Error executing {q}: {e}")

    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate_db()
