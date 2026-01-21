import models
import database
from sqlalchemy import text

def migrate():
    engine = database.engine
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE pool_assignments ADD COLUMN validated BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Column 'validated' added to 'pool_assignments'.")
        except Exception as e:
            print(f"Error (maybe column exists): {e}")

if __name__ == "__main__":
    migrate()
