import models
import database
from sqlalchemy import text

def apply_fks():
    engine = database.engine
    with engine.connect() as conn:
        print("Updating database constraints...")
        try:
            # 1. Drop existing constraints (to recreate them with ON DELETE)
            conn.execute(text("ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_category_id_fkey"))
            conn.execute(text("ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_club_id_fkey"))
            conn.execute(text("ALTER TABLE pool_assignments DROP CONSTRAINT IF EXISTS pool_assignments_category_id_fkey"))
            conn.execute(text("ALTER TABLE fights DROP CONSTRAINT IF EXISTS fights_fighter1_id_fkey"))
            conn.execute(text("ALTER TABLE fights DROP CONSTRAINT IF EXISTS fights_fighter2_id_fkey"))
            conn.execute(text("ALTER TABLE fights DROP CONSTRAINT IF EXISTS fights_winner_id_fkey"))

            # 2. Recreate constraints with correct behavior
            # Categories -> Participants (CASCADE)
            conn.execute(text("ALTER TABLE participants ADD CONSTRAINT participants_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE"))
            
            # Clubs -> Participants (SET NULL) - we don't want to delete participants if a club is deleted
            conn.execute(text("ALTER TABLE participants ADD CONSTRAINT participants_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL"))
            
            # Categories -> PoolAssignments (CASCADE)
            conn.execute(text("ALTER TABLE pool_assignments ADD CONSTRAINT pool_assignments_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE"))
            
            # Participants -> Fights (CASCADE)
            conn.execute(text("ALTER TABLE fights ADD CONSTRAINT fights_fighter1_id_fkey FOREIGN KEY (fighter1_id) REFERENCES participants(id) ON DELETE CASCADE"))
            conn.execute(text("ALTER TABLE fights ADD CONSTRAINT fights_fighter2_id_fkey FOREIGN KEY (fighter2_id) REFERENCES participants(id) ON DELETE CASCADE"))
            conn.execute(text("ALTER TABLE fights ADD CONSTRAINT fights_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES participants(id) ON DELETE CASCADE"))

            conn.commit()
            print("Database constraints updated successfully.")
        except Exception as e:
            print(f"Error updating constraints: {e}")
            conn.rollback()

if __name__ == "__main__":
    apply_fks()