from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Dropping pool_number and order columns from fights table...")
        try:
            conn.execute(text("ALTER TABLE fights DROP COLUMN pool_number"))
            print("Dropped pool_number")
        except Exception as e:
            print(f"Error dropping pool_number (maybe already dropped): {e}")
            
        try:
            conn.execute(text("ALTER TABLE fights DROP COLUMN \"order\""))
            print("Dropped order")
        except Exception as e:
            print(f"Error dropping order (maybe already dropped): {e}")
            
        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    migrate()

