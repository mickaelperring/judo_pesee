from database import engine
from sqlalchemy import text

def drop_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE fights DROP COLUMN validated"))
            conn.commit()
            print("Column dropped successfully.")
        except Exception as e:
            print(f"Error dropping column: {e}")

if __name__ == "__main__":
    drop_column()