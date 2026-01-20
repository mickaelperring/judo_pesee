from database import engine
from sqlalchemy import text

def add_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE participants ADD COLUMN hors_categorie BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Column added successfully.")
        except Exception as e:
            print(f"Error adding column (it might already exist): {e}")

if __name__ == "__main__":
    add_column()