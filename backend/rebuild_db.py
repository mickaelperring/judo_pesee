import models
import database
import pandas as pd
from sqlalchemy import text, insert

def rebuild():
    engine = database.engine
    
    # 1. Extraction des données actuelles
    tables = ["participants", "categories", "pool_assignments", "fights", "configuration", "clubs"]
    data = {}
    for table in tables:
        try:
            data[table] = pd.read_sql(f"SELECT * FROM {table}", engine)
            print(f"Table {table} loaded. Columns: {data[table].columns.tolist()}")
        except:
            data[table] = pd.DataFrame()
            print(f"Table {table} not found or empty.")

    # 2. Reset Schema
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    print("New schema created.")

    db = database.SessionLocal()
    try:
        # 3. Migrate Categories
        cat_map = {} # old_name/id -> new_id
        df_cats = data["categories"]
        for _, row in df_cats.iterrows():
            # Check if we have 'name' or 'Category' (from previous CSV logic)
            name = row.get('name') or row.get('Category')
            if not name: continue
            
            new_cat = models.Category(
                name=name, 
                include_in_stats=row.get('include_in_stats', True),
                birth_year_min=row.get('birth_year_min'),
                birth_year_max=row.get('birth_year_max')
            )
            db.add(new_cat)
            db.flush()
            cat_map[name] = new_cat.id
            if 'id' in row: cat_map[row['id']] = new_cat.id
        
        # 4. Migrate Clubs
        club_map = {} # old_name/id -> new_id
        df_clubs = data["clubs"]
        if not df_clubs.empty and 'name' in df_clubs.columns:
            for _, row in df_clubs.iterrows():
                new_club = models.Club(name=row['name'])
                db.add(new_club)
                db.flush()
                club_map[row['name']] = new_club.id
                club_map[row['id']] = new_club.id
        else:
            # Try to get clubs from participants if they were still strings
            df_parts = data["participants"]
            if 'club' in df_parts.columns:
                for club_name in df_parts['club'].unique():
                    if club_name:
                        new_club = models.Club(name=club_name)
                        db.add(new_club)
                        db.flush()
                        club_map[club_name] = new_club.id

        # 5. Migrate Participants
        for _, row in data["participants"].iterrows():
            # Find category id
            c_id = row.get('category_id')
            if not c_id and 'category' in row:
                c_id = cat_map.get(row['category'])
            
            # Find club id
            cl_id = row.get('club_id')
            if not cl_id and 'club' in row:
                cl_id = club_map.get(row['club'])

            new_p = models.Participant(
                id=int(row['id']),
                firstname=row['firstname'],
                lastname=row['lastname'],
                sex=row['sex'],
                birth_year=int(row['birth_year']),
                weight=float(row['weight']),
                pool_number=row['pool_number'] if pd.notnull(row['pool_number']) else None,
                hors_categorie=bool(row['hors_categorie']),
                category_id=c_id,
                club_id=cl_id
            )
            db.add(new_p)

        # 6. Migrate Assignments
        for _, row in data["pool_assignments"].iterrows():
            c_id = row.get('category_id')
            if not c_id and 'category' in row:
                c_id = cat_map.get(row['category'])
                
            new_a = models.PoolAssignment(
                pool_number=int(row['pool_number']),
                table_number=int(row['table_number']),
                order=int(row['order']),
                validated=bool(row['validated']),
                category_id=c_id
            )
            db.add(new_a)

        # 7. Migrate Fights
        for _, row in data["fights"].iterrows():
            winner_id = int(row['winner_id']) if pd.notnull(row['winner_id']) else None
            new_f = models.Fight(
                id=int(row['id']),
                fighter1_id=int(row['fighter1_id']),
                fighter2_id=int(row['fighter2_id']),
                score1=int(row['score1']),
                score2=int(row['score2']),
                winner_id=winner_id
            )
            db.add(new_f)

        # 8. Migrate Config
        for _, row in data["configuration"].iterrows():
            new_c = models.Configuration(key=row['key'], value=row['value'])
            db.add(new_c)

        db.commit()
        print("Rebuild and Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    rebuild()