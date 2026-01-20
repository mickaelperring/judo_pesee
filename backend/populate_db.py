import random
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def populate():
    db = SessionLocal()
    
    categories = ["Benjamins", "Poussins", "Moustiques"]
    clubs = ["Judo Club Montlebon", "Judo Club Pontarlier", "Dojo Franc-Comtois", "Judo Club Morteau", "Val de Morteau"]
    firstnames = ["Lucas", "Leo", "Louis", "Gabriel", "Jules", "Adam", "Arthur", "Thomas", "Emma", "Jade", "Louise", "Alice", "Chloé", "Lina", "Lea", "Mila"]
    lastnames = ["Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefebvre"]
    
    participants = []
    
    for category in categories:
        for _ in range(30):
            sex = random.choice(["M", "F"])
            # Adjust weight range slightly by category for realism
            if category == "Moustiques":
                weight = random.uniform(18, 30)
                year = 2018
            elif category == "Poussins":
                weight = random.uniform(25, 40)
                year = 2016
            else: # Benjamins
                weight = random.uniform(30, 55)
                year = 2014
                
            p = models.Participant(
                category=category,
                firstname=random.choice(firstnames),
                lastname=random.choice(lastnames),
                sex=sex,
                birth_year=year,
                club=random.choice(clubs),
                weight=round(weight, 1),
                pool_number=None,
                score=None
            )
            participants.append(p)
            
    try:
        db.add_all(participants)
        db.commit()
        print(f"Successfully added {len(participants)} participants.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate()
