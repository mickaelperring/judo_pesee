import models
import database
from sqlalchemy.orm import Session

def add_data():
    db = database.SessionLocal()
    try:
        # 1. Create category if not exists
        cat_name = "Mini-Poussins"
        cat = db.query(models.Category).filter(models.Category.name == cat_name).first()
        if not cat:
            cat = models.Category(name=cat_name, include_in_stats=True)
            db.add(cat)
            db.commit()
            print(f"Category {cat_name} created.")

        # 2. Add dummy participants
        dummies = [
            {"firstname": "Léo", "lastname": "Petit", "sex": "M", "birth_year": 2017, "weight": 22.5, "club": "Judo Club Montlebon"},
            {"firstname": "Mila", "lastname": "Dubois", "sex": "F", "birth_year": 2017, "weight": 21.0, "club": "Dojo du Haut-Doubs"},
            {"firstname": "Noah", "lastname": "Moreau", "sex": "M", "birth_year": 2018, "weight": 24.2, "club": "Judo Club Morteau"},
            {"firstname": "Emma", "lastname": "Leroy", "sex": "F", "birth_year": 2017, "weight": 23.5, "club": "Judo Club Montlebon"},
            {"firstname": "Lucas", "lastname": "Garcia", "sex": "M", "birth_year": 2018, "weight": 20.8, "club": "Pontarlier Judo"},
            {"firstname": "Chloé", "lastname": "Rousseau", "sex": "F", "birth_year": 2017, "weight": 22.1, "club": "Dojo du Haut-Doubs"},
        ]

        for d in dummies:
            # Check for duplicates to avoid re-running issues
            exists = db.query(models.Participant).filter(
                models.Participant.firstname == d["firstname"],
                models.Participant.lastname == d["lastname"],
                models.Participant.category == cat_name
            ).first()
            
            if not exists:
                p = models.Participant(
                    category=cat_name,
                    firstname=d["firstname"],
                    lastname=d["lastname"],
                    sex=d["sex"],
                    birth_year=d["birth_year"],
                    weight=d["weight"],
                    club=d["club"]
                )
                db.add(p)
        
        db.commit()
        print(f"Added {len(dummies)} participants in {cat_name}.")
    finally:
        db.close()

if __name__ == "__main__":
    add_data()
