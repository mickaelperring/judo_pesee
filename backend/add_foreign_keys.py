from database import engine
from sqlalchemy import text

def add_foreign_keys():
    with engine.connect() as conn:
        try:
            # Add FK for fighter1_id
            conn.execute(text("ALTER TABLE fights ADD CONSTRAINT fk_fights_fighter1_id FOREIGN KEY (fighter1_id) REFERENCES participants(id)"))
            # Add FK for fighter2_id
            conn.execute(text("ALTER TABLE fights ADD CONSTRAINT fk_fights_fighter2_id FOREIGN KEY (fighter2_id) REFERENCES participants(id)"))
            
            conn.commit()
            print("Foreign keys added successfully.")
        except Exception as e:
            print(f"Error adding foreign keys: {e}")

if __name__ == "__main__":
    add_foreign_keys()
