import models
import database
from sqlalchemy import text

def migrate():
    engine = database.engine
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE categories ADD COLUMN birth_year_min INTEGER"))
            conn.execute(text("ALTER TABLE categories ADD COLUMN birth_year_max INTEGER"))
            conn.commit()
            print("Columns birth_year_min and birth_year_max added to 'categories'.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    migrate()
