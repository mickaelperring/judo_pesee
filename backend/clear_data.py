import database
from sqlalchemy import text

def clear_data():
    db = database.SessionLocal()
    try:
        # Clear transactional tables
        print("Clearing fights...")
        db.execute(text("TRUNCATE TABLE fights RESTART IDENTITY CASCADE"))
        
        print("Clearing pool assignments...")
        db.execute(text("TRUNCATE TABLE pool_assignments RESTART IDENTITY CASCADE"))
        
        print("Clearing participants...")
        db.execute(text("TRUNCATE TABLE participants RESTART IDENTITY CASCADE"))
        
        # Optional: Clear clubs if they are purely derived from participants
        # db.execute(text("TRUNCATE TABLE clubs RESTART IDENTITY CASCADE"))
        
        db.commit()
        print("Database cleared (participants, fights, pools). Configuration and Categories preserved.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_data()