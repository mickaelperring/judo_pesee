from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import os
import models, schemas, database
from database import get_db

# Create Tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

origins = ["*"] # Relaxed CORS for dev

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

import yaml

@app.get("/chrono_config")
def get_chrono_config():
    with open(os.path.join(DATA_DIR, "chrono_config.yaml"), "r") as f:
        config = yaml.safe_load(f)
    return config

def migrate_categories_to_db():
    db = database.SessionLocal()
    try:
        count = db.query(models.Category).count()
        if count == 0:
            df = pd.read_csv(os.path.join(DATA_DIR, "categories.csv"))
            for name in df['Category'].tolist():
                new_cat = models.Category(name=name, include_in_stats=True)
                db.add(new_cat)
            db.commit()
            print("Categories migrated to DB")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        db.close()

migrate_categories_to_db()

@app.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    cats = db.query(models.Category).all()
    return [c.name for c in cats]

@app.get("/categories/full", response_model=List[schemas.Category])
def get_categories_full(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()

@app.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    db_cat = models.Category(**category.dict())
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

@app.put("/categories/{category_id}", response_model=schemas.Category)
def update_category(category_id: int, category_update: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in category_update.dict(exclude_unset=True).items():
        setattr(db_cat, key, value)
    db.commit()
    db.refresh(db_cat)
    return db_cat

@app.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(db_cat)
    db.commit()
    return {"message": "Category deleted"}

@app.get("/preregistrations", response_model=List[schemas.ParticipantBase])
def get_preregistrations():
    # Return pre-registrations. Note: logic might change if we want to search them.
    # For now, just return all.
    try:
        df = pd.read_csv(os.path.join(DATA_DIR, "preregistrations.csv"))
        # Rename columns to match schema if necessary
        # Schema: category, firstname, lastname, sex, birth_year, club, weight
        # CSV: Category, Firstname, Lastname, Sex, BirthYear, Club, Weight
        df.columns = [c.lower() for c in df.columns]
        df = df.rename(columns={'birthyear': 'birth_year'})
        return df.to_dict(orient='records')
    except Exception as e:
        print(e)
        return []

def calculate_stats(participants, fights):
    stats = {p.id: {"score": 0, "victories": 0, "has_fights": False} for p in participants}
    for f in fights:
        is_played = f.winner_id is not None
        if f.fighter1_id in stats:
            stats[f.fighter1_id]["score"] += f.score1
            if f.winner_id == f.fighter1_id:
                stats[f.fighter1_id]["victories"] += 1
            if is_played:
                stats[f.fighter1_id]["has_fights"] = True
        if f.fighter2_id in stats:
            stats[f.fighter2_id]["score"] += f.score2
            if f.winner_id == f.fighter2_id:
                stats[f.fighter2_id]["victories"] += 1
            if is_played:
                stats[f.fighter2_id]["has_fights"] = True
    return stats

@app.get("/participants", response_model=List[schemas.Participant])
def get_participants(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Participant)
    if category:
        query = query.filter(models.Participant.category == category)
    participants = query.all()
    
    fight_query = db.query(models.Fight)
    if category:
        fight_query = fight_query.filter(models.Fight.category == category)
    fights = fight_query.all()
    
    stats = calculate_stats(participants, fights)
                
    for p in participants:
        p.score = stats[p.id]["score"]
        p.victories = stats[p.id]["victories"]
        p.has_fights = stats[p.id]["has_fights"]
        
    return participants

# Fights Endpoints
@app.get("/fights", response_model=List[schemas.Fight])
def get_fights(category: Optional[str] = None, pool_number: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Fight)
    if category:
        query = query.filter(models.Fight.category == category)
    if pool_number is not None:
        # Join with Participant to filter by pool_number
        # We check fighter1's pool number (assuming both are in same pool)
        query = query.join(models.Participant, models.Fight.fighter1_id == models.Participant.id)\
                     .filter(models.Participant.pool_number == pool_number)
    
    # Order by ID which is creation order
    return query.order_by(models.Fight.id).all()

@app.post("/fights", response_model=List[schemas.Fight])
def create_fights(fights: List[schemas.FightCreate], db: Session = Depends(get_db)):
    # Batch create
    new_fights = []
    for f in fights:
        # Check duplicate? Or just insert.
        # Assuming frontend manages uniqueness or clears first.
        # Let's check if fight exists for this pair in this pool?
        # Simpler: just insert. Frontend logic "init pool" should handle "if not exists".
        db_fight = models.Fight(**f.dict())
        db.add(db_fight)
        new_fights.append(db_fight)
    db.commit()
    for f in new_fights:
        db.refresh(f)
    return new_fights

@app.put("/fights/{fight_id}", response_model=schemas.Fight)
def update_fight(fight_id: int, fight_update: schemas.FightUpdate, db: Session = Depends(get_db)):
    db_fight = db.query(models.Fight).filter(models.Fight.id == fight_id).first()
    if not db_fight:
        raise HTTPException(status_code=404, detail="Fight not found")
    
    for key, value in fight_update.dict(exclude_unset=True).items():
        setattr(db_fight, key, value)
    
    db.commit()
    db.refresh(db_fight)
    return db_fight

@app.delete("/fights/{fight_id}")
def delete_fight(fight_id: int, db: Session = Depends(get_db)):
    db_fight = db.query(models.Fight).filter(models.Fight.id == fight_id).first()
    if not db_fight:
        raise HTTPException(status_code=404, detail="Fight not found")
    
    db.delete(db_fight)
    db.commit()
    return {"message": "Fight deleted"}

@app.post("/participants", response_model=schemas.Participant)
def create_participant(participant: schemas.ParticipantCreate, db: Session = Depends(get_db)):
    db_participant = models.Participant(**participant.dict())
    db.add(db_participant)
    db.commit()
    db.refresh(db_participant)
    return db_participant

@app.put("/participants/{participant_id}", response_model=schemas.Participant)
def update_participant(participant_id: int, participant_update: schemas.ParticipantUpdate, db: Session = Depends(get_db)):
    db_participant = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if not db_participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    for key, value in participant_update.dict(exclude_unset=True).items():
        setattr(db_participant, key, value)
    
    db.commit()
    db.refresh(db_participant)
    return db_participant

@app.delete("/participants/{participant_id}")
def delete_participant(participant_id: int, db: Session = Depends(get_db)):
    db_participant = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if not db_participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    db.delete(db_participant)
    db.commit()
    return {"message": "Participant deleted"}

@app.put("/participants/batch/update_pools")
def update_pools(updates: List[dict], db: Session = Depends(get_db)):
    # updates expects list of {id: int, pool_number: int}
    # This is for drag and drop updates
    affected_keys = set() # (category, pool_number)

    # First Pass: Identify affected pools and update participants
    for update in updates:
        p = db.query(models.Participant).filter(models.Participant.id == update['id']).first()
        if p:
            # Mark old pool
            if p.pool_number is not None:
                affected_keys.add((p.category, p.pool_number))
            
            p.pool_number = update['pool_number']
            # Mark new pool
            affected_keys.add((p.category, p.pool_number))
            
    # Second Pass: Cleanup empty assignments
    # We no longer delete fights for affected pools to preserve history
    for (cat, pool_num) in affected_keys:
        # Check if pool is empty
        count = db.query(models.Participant).filter(
            models.Participant.category == cat, 
            models.Participant.pool_number == pool_num
        ).count()
        
        if count == 0:
            # Delete assignment if exists
            assignment = db.query(models.PoolAssignment).filter(
                models.PoolAssignment.category == cat,
                models.PoolAssignment.pool_number == pool_num
            ).first()
            if assignment:
                db.delete(assignment)

    db.commit()
    return {"status": "ok"}

@app.get("/clubs", response_model=List[str])
def get_clubs(db: Session = Depends(get_db)):
    # Get distinct clubs from DB
    clubs = db.query(models.Participant.club).distinct().all()
    return [c[0] for c in clubs]

# Placeholder for PDF and Algo
@app.post("/generate_pools/{category}")
def generate_pools(category: str, db: Session = Depends(get_db)):
    # Reset fights for this category to ensure clean state
    db.query(models.Fight).filter(models.Fight.category == category).delete()

    participants = db.query(models.Participant).filter(models.Participant.category == category).all()
    
    # Group by Sex
    males = [p for p in participants if p.sex == 'M']
    females = [p for p in participants if p.sex == 'F']
    
    def distribute_pools(group, start_pool_num):
        if not group:
            return start_pool_num
        
        group.sort(key=lambda x: x.weight)
        n = len(group)
        
        # Determine number of pools
        # Aim for size 4, min size 3.
        # If n < 3, single pool.
        if n < 3:
            num_pools = 1
        else:
            num_pools = (n + 3) // 4  # ceil(n/4) approximation for chunks of ~4
            # Check if this results in any pool < 3?
            # if n=5, num=2. base=2, extra=1 -> [3, 2]. 2 is < 3. 
            # In that specific case (n=5), we prefer 1 pool of 5.
            if n == 5:
                num_pools = 1
        
        base_size = n // num_pools
        extra = n % num_pools
        
        idx = 0
        current_pool = start_pool_num
        
        # We might want to distribute 'extra' to the middle or end, 
        # but simple distribution is: first 'extra' pools get +1.
        for i in range(num_pools):
            size = base_size + (1 if i < extra else 0)
            chunk = group[idx : idx + size]
            for p in chunk:
                p.pool_number = current_pool
            
            current_pool += 1
            idx += size
            
        return current_pool

    next_pool_num = 1
    next_pool_num = distribute_pools(males, next_pool_num)
    distribute_pools(females, next_pool_num)
            
    db.commit()
    return {"message": "Pools generated"}

@app.get("/score_sheet/{category}")
def download_score_sheet(category: str, base_url: Optional[str] = None, db: Session = Depends(get_db)):
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    import io
    from urllib.parse import quote

    participants = db.query(models.Participant)\
        .filter(models.Participant.category == category)\
        .order_by(models.Participant.pool_number, models.Participant.weight)\
        .all()
    
    # Group by pool
    pools = {}
    for p in participants:
        if p.pool_number:
            if p.pool_number not in pools:
                pools[p.pool_number] = []
            pools[p.pool_number].append(p)
            
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []
    
    sorted_pool_nums = sorted(pools.keys())
    
    if not sorted_pool_nums:
        elements.append(Paragraph(f"Aucune poule générée pour {category}", styles['Title']))
    
    for pool_num in sorted_pool_nums:
        pool_participants = pools[pool_num]
        
        # Header
        elements.append(Paragraph(f"Catégorie: {category} - Poule {pool_num}", styles['Title']))
        elements.append(Spacer(1, 1*cm))
        
        # Table Data
        data = [["Nom", "Prénom", "Club", "Poids", "Score"]]
        for p in pool_participants:
            data.append([p.lastname, p.firstname, p.club, f"{p.weight} kg", "_______"])
            
        t = Table(data, colWidths=[4*cm, 4*cm, 5*cm, 2*cm, 3*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 2*cm))
        
        # Link to Score Page
        if base_url:
            # Construct URL manually or safely join
            # Warning: category might contain spaces, ensure encoded in Frontend, decoded here?
            # Browser sends it encoded in path param? No, query param.
            # In URL: /score_poule/Category/1
            score_url = f"{base_url}/score_poule/{quote(category)}/{pool_num}"
            
            # Clickable link
            link_text = f'<link href="{score_url}" color="blue"><u>Saisir les scores en ligne (Cliquer ici)</u></link>'
            elements.append(Paragraph(link_text, styles['Normal']))
            elements.append(Spacer(1, 0.5*cm))
            # Text URL for printing
            elements.append(Paragraph(f"Lien: {score_url}", styles['BodyText']))
            
        elements.append(PageBreak())
        
    doc.build(elements)
    
    buffer.seek(0)
    return FileResponse(buffer, media_type='application/pdf', filename=f"Feuille_{category}.pdf")

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    # 1. Identify categories to include
    active_cats_objs = db.query(models.Category).filter(models.Category.include_in_stats == True).all()
    included_cat_names = [c.name for c in active_cats_objs]

    # 2. Get participants only from these categories
    participants = db.query(models.Participant).filter(models.Participant.category.in_(included_cat_names)).all()
    if not participants:
        return {"by_club": [], "warnings": []}
    
    # 3. Get fights for these participants
    fights = db.query(models.Fight).filter(models.Fight.category.in_(included_cat_names)).all()
    stats_map = calculate_stats(participants, fights)
    
    # Enrich participants
    for p in participants:
        p.score = stats_map[p.id]["score"]
        p.victories = stats_map[p.id]["victories"]
    
    data = [{
        "club": p.club, 
        "score": p.score,
        "victories": p.victories,
        "has_score": p.score > 0 or stats_map[p.id]["has_fights"]
    } for p in participants]
    
    df = pd.DataFrame(data)
    stats = df.groupby('club').agg(
        total_score=('score', 'sum'),
        total_victories=('victories', 'sum'),
        count=('club', 'count')
    ).reset_index().to_dict(orient='records')
    
    # Warning for participants with 0 score (and maybe no fights?)
    # Frontend says "Ces participants n'ont pas encore de score enregistré."
    # If they have 0 points but played, is that a warning? Maybe not.
    # But usually 0 points means not played or lost everything.
    # Let's keep logic simple: score is None? But score is 0 by default now.
    
    warnings = [p for p in participants if p.score == 0 and not stats_map[p.id]["has_fights"]]
    
    return {
        "by_club": stats,
        "warnings": warnings
    }

# Configuration
@app.get("/configuration/{key}")
def get_config(key: str, db: Session = Depends(get_db)):
    config = db.query(models.Configuration).filter(models.Configuration.key == key).first()
    if not config:
        return {"value": None}
    return {"value": config.value}

@app.post("/configuration")
def update_config(config: schemas.ConfigUpdate, db: Session = Depends(get_db)):
    db_config = db.query(models.Configuration).filter(models.Configuration.key == config.key).first()
    if db_config:
        db_config.value = config.value
    else:
        db_config = models.Configuration(key=config.key, value=config.value)
        db.add(db_config)
    db.commit()
    return {"status": "ok"}

# Pool Assignments
@app.get("/pool_assignments", response_model=List[schemas.PoolAssignment])
def get_pool_assignments(db: Session = Depends(get_db)):
    return db.query(models.PoolAssignment).all()

@app.post("/pool_assignments/batch")
def update_pool_assignments(assignments: List[schemas.PoolAssignmentBase], db: Session = Depends(get_db)):
    # Simple strategy: Clear all existing for these categories?
    # Or upsert?
    # Since the frontend sends the "state of the board", we might want to clear existing entries for the moved pools and re-insert.
    # However, if we move ONE pool, we send all? Or just the moved one?
    # The prompt says "Ceci doit etre sauvé".
    # Let's assume the frontend sends a list of ALL assignments (snapshot) or just updates.
    # Safe approach: Upsert based on Category + PoolNumber.
    
    for assignment in assignments:
        # Find existing
        existing = db.query(models.PoolAssignment).filter(
            models.PoolAssignment.category == assignment.category,
            models.PoolAssignment.pool_number == assignment.pool_number
        ).first()
        
        if existing:
            existing.table_number = assignment.table_number
            existing.order = assignment.order
        else:
            new_assign = models.PoolAssignment(**assignment.dict())
            db.add(new_assign)
            
    db.commit()
    return {"status": "ok"}

@app.post("/pool_assignments/validate")
def validate_pool(validation: schemas.PoolValidation, db: Session = Depends(get_db)):
    print(f"Received validation request: {validation}")
    category = validation.category
    pool_number = validation.pool_number
    validated = validation.validated

    existing = db.query(models.PoolAssignment).filter(
        models.PoolAssignment.category == category,
        models.PoolAssignment.pool_number == pool_number
    ).first()

    print(f"Existing assignment found: {existing}")

    if existing:
        existing.validated = validated
        db.add(existing) # Ensure session tracks it
    else:
        # If no assignment exists (pool not on table), create one.
        # Use table_number=0 to indicate unassigned to a physical table but tracking status
        new_assign = models.PoolAssignment(
            category=category, 
            pool_number=pool_number,
            table_number=0, 
            order=0,
            validated=validated
        )
        db.add(new_assign)
    
    db.commit()
    return {"status": "ok", "validated": validated}