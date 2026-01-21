import models
import database
from sqlalchemy import func

def cleanup():
    db = database.SessionLocal()
    try:
        # Get all assignments
        assignments = db.query(models.PoolAssignment).all()
        deleted_count = 0
        
        for a in assignments:
            # Check if any participant exists for this category/pool
            count = db.query(models.Participant).filter(
                models.Participant.category == a.category,
                models.Participant.pool_number == a.pool_number
            ).count()
            
            if count == 0:
                print(f"Deleting empty assignment: {a.category} Pool {a.pool_number}")
                db.delete(a)
                deleted_count += 1
        
        db.commit()
        print(f"Cleanup complete. Deleted {deleted_count} assignments.")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
