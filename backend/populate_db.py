import models
import database
import random

def populate():
    db = database.SessionLocal()
    try:
        # 1. Get existing categories
        categories = db.query(models.Category).all()
        if not categories:
            print("No categories found. Please create some first.")
            return

        # 2. Ensure we have some clubs
        club_names = ["Judo Club Montlebon", "Dojo du Haut-Doubs", "Morteau Judo", "Pontarlier Arts Martiaux", "Val de Morteau Judo"]
        clubs = []
        for name in club_names:
            club = db.query(models.Club).filter(models.Club.name == name).first()
            if not club:
                club = models.Club(name=name)
                db.add(club)
                db.flush()
            clubs.append(club)

        # 3. Dummy names components
        firstnames_m = ["Léo", "Lucas", "Noah", "Gabriel", "Adam", "Arthur", "Louis", "Jules", "Maël", "Liam"]
        firstnames_f = ["Emma", "Mila", "Chloé", "Alice", "Lina", "Léa", "Mia", "Jade", "Manon", "Rose"]
        lastnames = ["Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefebvre", "Garcia", "David"]

        added_count = 0
        for cat in categories:
            # Generate 50 participants per category
            num_to_add = 50
            
            # Determine suitable birth year for this category
            y_min = cat.birth_year_min or 2010
            y_max = cat.birth_year_max or y_min
            
            for _ in range(num_to_add):
                sex = random.choice(["M", "F"])
                fname = random.choice(firstnames_m if sex == "M" else firstnames_f)
                lname = random.choice(lastnames)
                
                # Check for duplicate
                exists = db.query(models.Participant).filter(
                    models.Participant.firstname == fname,
                    models.Participant.lastname == lname,
                    models.Participant.category_id == cat.id
                ).first()
                
                if not exists:
                    p = models.Participant(
                        firstname=fname,
                        lastname=lname,
                        sex=sex,
                        birth_year=random.randint(y_min, y_max),
                        weight=round(random.uniform(20.0, 60.0), 1),
                        category_id=cat.id,
                        club_id=random.choice(clubs).id,
                        hors_categorie=False
                    )
                    db.add(p)
                    added_count += 1
        
        db.commit()
        print(f"Successfully added {added_count} dummy participants across {len(categories)} categories.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate()