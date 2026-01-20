from database import engine
from models import Base
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Creating fights table...")
        # We can use Base.metadata.create_all for new tables, but let's be specific or use it generally
        Base.metadata.create_all(bind=engine)
        
        print("Dropping legacy columns from participants...")
        try:
            conn.execute(text("ALTER TABLE participants DROP COLUMN score"))
        except Exception as e:
            print(f"Error dropping score (maybe already dropped): {e}")
            
        try:
            conn.execute(text("ALTER TABLE participants DROP COLUMN victories"))
        except Exception as e:
            print(f"Error dropping victories (maybe already dropped): {e}")
            
        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    migrate()
