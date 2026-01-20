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

@app.get("/categories", response_model=List[str])
def get_categories():
    df = pd.read_csv(os.path.join(DATA_DIR, "categories.csv"))
    return df['Category'].tolist()

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

@app.get("/participants", response_model=List[schemas.Participant])
def get_participants(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Participant)
    if category:
        query = query.filter(models.Participant.category == category)
    participants = query.all()
    
    # Calculate scores from fights
    # Fetch all fights (optimize by filtering category if provided)
    fight_query = db.query(models.Fight)
    if category:
        fight_query = fight_query.filter(models.Fight.category == category)
    fights = fight_query.all()
    
    # Map id -> {score, victories}
    stats = {p.id: {"score": 0, "victories": 0} for p in participants}
    
    for f in fights:
        if f.fighter1_id in stats:
            stats[f.fighter1_id]["score"] += f.score1
            if f.winner_id == f.fighter1_id:
                stats[f.fighter1_id]["victories"] += 1
        
        if f.fighter2_id in stats:
            stats[f.fighter2_id]["score"] += f.score2
            if f.winner_id == f.fighter2_id:
                stats[f.fighter2_id]["victories"] += 1
                
    # Attach to participant objects (transiently)
    for p in participants:
        p.score = stats[p.id]["score"]
        p.victories = stats[p.id]["victories"]
        
    return participants

# Fights Endpoints
@app.get("/fights", response_model=List[schemas.Fight])
def get_fights(category: Optional[str] = None, pool_number: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Fight)
    if category:
        query = query.filter(models.Fight.category == category)
    if pool_number:
        query = query.filter(models.Fight.pool_number == pool_number)
    return query.order_by(models.Fight.order).all()

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
    for update in updates:
        p = db.query(models.Participant).filter(models.Participant.id == update['id']).first()
        if p:
            p.pool_number = update['pool_number']
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
    # Total scores and count by club
    # Using pandas for quick grouping if list is small, or SQL group by
    participants = db.query(models.Participant).all()
    if not participants:
        return []
    
    data = [{
        "club": p.club, 
        "score": p.score if p.score is not None else 0,
        "has_score": p.score is not None
    } for p in participants]
    
    df = pd.DataFrame(data)
    stats = df.groupby('club').agg(
        total_score=('score', 'sum'),
        count=('club', 'count')
    ).reset_index().to_dict(orient='records')
    
    missing_scores = df[~df['has_score']].to_dict(orient='records') # Simplified
    
    return {
        "by_club": stats,
        "warnings": [p for p in participants if p.score is None]
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