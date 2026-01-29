from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import pandas as pd
import os
import models, schemas, database
from database import get_db
import yaml
from urllib.parse import quote
import io
import math

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

import unicodedata
def normalize_name(s: str) -> str:
    if not s: return ""
    # Convert to string and lowercase
    s = str(s).lower()
    # Remove accents
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    # Remove all non-alphanumeric characters (including punctuation and spaces)
    s = ''.join(e for e in s if e.isalnum())
    return s.upper()

@app.get("/chrono_config")
def get_chrono_config():
    with open(os.path.join(DATA_DIR, "chrono_config.yaml"), "r") as f:
        config = yaml.safe_load(f)
    return config

# Helper to get or create club
def get_or_create_club(db: Session, name: str):
    if not name: return None
    norm_name = normalize_name(name)
    
    # Search for an existing club with the same normalized name
    # We add a temporary column logic or just fetch all and compare for maximum reliability
    all_clubs = db.query(models.Club).all()
    for club in all_clubs:
        if normalize_name(club.name) == norm_name:
            return club
            
    # Not found, create new one with original (but trimmed) name
    new_club = models.Club(name=name.strip())
    db.add(new_club)
    db.flush()
    return new_club

@app.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    cats = db.query(models.Category).order_by(models.Category.birth_year_min.asc()).all()
    return [c.name for c in cats]

@app.get("/categories/full", response_model=List[schemas.Category])
def get_categories_full(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.birth_year_min.asc()).all()

@app.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    data = category.dict()
    if data.get('birth_year_max') is None:
        data['birth_year_max'] = data.get('birth_year_min')
    db_cat = models.Category(**data)
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

@app.put("/categories/{category_id}", response_model=schemas.Category)
def update_category(category_id: int, category_update: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    db_cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = category_update.dict(exclude_unset=True)
    if 'birth_year_min' in update_data and 'birth_year_max' not in update_data:
        if db_cat.birth_year_max == db_cat.birth_year_min:
            update_data['birth_year_max'] = update_data['birth_year_min']

    for key, value in update_data.items():
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

@app.get("/preregistrations")
def get_preregistrations(db: Session = Depends(get_db)):
    config = db.query(models.Configuration).filter(models.Configuration.key == "google_sheet_url").first()
    url = config.value if config and config.value else None
    
    try:
        if url:
            if "docs.google.com/spreadsheets" in url:
                if "/edit" in url:
                    url = url.split("/edit")[0] + "/export?format=csv"
                elif "export" not in url:
                    url = url.rstrip("/") + "/export?format=csv"
            df = pd.read_csv(url)
        else:
            csv_path = os.path.join(DATA_DIR, "preregistrations.csv")
            if not os.path.exists(csv_path): return []
            df = pd.read_csv(csv_path)

        import unicodedata
        def normalize_str(s):
            s = str(s).lower()
            s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
            return ''.join(e for e in s if e.isalnum())

        df.columns = [normalize_str(c) for c in df.columns]
        mapping = {
            'firstname': ['prenom', 'prenomjudoka', 'firstname'],
            'lastname': ['nom', 'nomdujudoka', 'lastname'],
            'sex': ['sex', 'sexe', 'genre'],
            'birth_year': ['birthyear', 'anneenaissance', 'datedenaissance', 'datenaissance', 'naissance'],
            'club': ['club', 'clubdejudorattache', 'association'],
            'weight': ['weight', 'poids'],
            'category': ['category', 'categorie']
        }
        
        final_df = pd.DataFrame()
        for target, variations in mapping.items():
            for var in variations:
                normalized_var = normalize_str(var)
                if normalized_var in df.columns:
                    final_df[target] = df[normalized_var]
                    break
        
        if 'birth_year' in final_df.columns:
            def extract_year(val):
                s = str(val)
                if '/' in s: return s.split('/')[-1]
                if '-' in s: return s.split('-')[0] if len(s.split('-')[0]) == 4 else s.split('-')[-1]
                return s
            final_df['birth_year'] = final_df['birth_year'].apply(extract_year)
            final_df['birth_year'] = pd.to_numeric(final_df['birth_year'], errors='coerce').fillna(0).astype(int)

        if 'weight' in final_df.columns:
            final_df['weight'] = final_df['weight'].astype(str).str.replace('kg', '', case=False).str.replace(',', '.')
            final_df['weight'] = pd.to_numeric(final_df['weight'], errors='coerce').fillna(0)

        if 'sex' in final_df.columns:
            final_df['sex'] = final_df['sex'].astype(str).str.lower().apply(lambda x: 'F' if 'f' in x else 'M')

        # Map names to IDs for frontend
        cat_configs = db.query(models.Category).all()
        club_configs = db.query(models.Club).all()
        
        def process_row(row):
            year = row.get('birth_year')
            # Category deduction
            cat_id = None
            if year:
                for c in cat_configs:
                    min_y = c.birth_year_min
                    max_y = c.birth_year_max or min_y
                    if min_y is not None and min_y <= year <= max_y:
                        cat_id = c.id
                        break
            
            # Club lookup
            club_name = str(row.get('club', '')).strip()
            norm_club_name = normalize_name(club_name)
            club_id = next((c.id for c in club_configs if normalize_name(c.name) == norm_club_name), None)
            
            return pd.Series({
                **row.to_dict(),
                'category_id': cat_id,
                'club_id': club_id,
                'category_name': next((c.name for c in cat_configs if c.id == cat_id), "À classer"),
                'club_name': club_name
            })

        final_df = final_df.apply(process_row, axis=1)
        
        data = final_df.to_dict(orient='records')
        
        def clean_nans(d):
            cleaned = {}
            for k, v in d.items():
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    cleaned[k] = None
                else:
                    cleaned[k] = v
            return cleaned
            
        return [clean_nans(d) for d in data]
    except Exception as e:
        print(f"Error fetching preregistrations: {e}")
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
    query = db.query(models.Participant).options(joinedload(models.Participant.category), joinedload(models.Participant.club))
    if category:
        query = query.join(models.Category).filter(models.Category.name == category)
    participants = query.all()
    
    # Get all fights for these participants
    p_ids = [p.id for p in participants]
    fights = db.query(models.Fight).filter(models.Fight.fighter1_id.in_(p_ids) | models.Fight.fighter2_id.in_(p_ids)).all()
    
    stats = calculate_stats(participants, fights)
    for p in participants:
        p.score = stats[p.id]["score"]
        p.victories = stats[p.id]["victories"]
        p.has_fights = stats[p.id]["has_fights"]
        p.category_name = p.category.name if p.category else ""
        p.club_name = p.club.name if p.club else ""
        
    return participants

@app.post("/participants", response_model=schemas.Participant)
def create_participant(participant: dict, db: Session = Depends(get_db)):
    # Handle club creation if needed
    club_name = participant.get('club_name')
    club_id = participant.get('club_id')
    
    if (not club_id or club_id == 0) and club_name:
        club = get_or_create_club(db, club_name)
        participant['club_id'] = club.id
    
    # Remove extra fields not in model
    data = {k: v for k, v in participant.items() if k in models.Participant.__table__.columns.keys()}
    
    db_participant = models.Participant(**data)
    db.add(db_participant)
    db.commit()
    db.refresh(db_participant)
    
    # Load relationships for response
    db_participant = db.query(models.Participant).options(joinedload(models.Participant.category), joinedload(models.Participant.club)).filter(models.Participant.id == db_participant.id).first()
    db_participant.category_name = db_participant.category.name
    db_participant.club_name = db_participant.club.name
    return db_participant

@app.put("/participants/{participant_id}", response_model=schemas.Participant)
def update_participant(participant_id: int, participant_update: dict, db: Session = Depends(get_db)):
    db_participant = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if not db_participant: raise HTTPException(status_code=404, detail="Participant not found")
    
    # Handle club creation if needed
    club_name = participant_update.get('club_name')
    club_id = participant_update.get('club_id')
    if (not club_id or club_id == 0) and club_name:
        club = get_or_create_club(db, club_name)
        participant_update['club_id'] = club.id

    for key, value in participant_update.items():
        if key in models.Participant.__table__.columns.keys():
            setattr(db_participant, key, value)
            
    db.commit()
    db.refresh(db_participant)
    
    # Reload for response
    db_participant = db.query(models.Participant).options(joinedload(models.Participant.category), joinedload(models.Participant.club)).filter(models.Participant.id == db_participant.id).first()
    db_participant.category_name = db_participant.category.name
    db_participant.club_name = db_participant.club.name
    return db_participant

@app.delete("/participants/{participant_id}")
def delete_participant(participant_id: int, db: Session = Depends(get_db)):
    db_participant = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if not db_participant: raise HTTPException(status_code=404, detail="Participant not found")
    db.delete(db_participant)
    db.commit()
    return {"message": "Participant deleted"}

@app.put("/participants/batch/update_pools")
def update_pools(updates: List[dict], db: Session = Depends(get_db)):
    affected_keys = set() # (category_id, pool_number)
    for update in updates:
        p = db.query(models.Participant).filter(models.Participant.id == update['id']).first()
        if p:
            if p.pool_number is not None: affected_keys.add((p.category_id, p.pool_number))
            p.pool_number = update['pool_number']
            affected_keys.add((p.category_id, p.pool_number))
            
    for (c_id, pool_num) in affected_keys:
        count = db.query(models.Participant).filter(models.Participant.category_id == c_id, models.Participant.pool_number == pool_num).count()
        if count == 0:
            assignment = db.query(models.PoolAssignment).filter(models.PoolAssignment.category_id == c_id, models.PoolAssignment.pool_number == pool_num).first()
            if assignment: db.delete(assignment)
    db.commit()
    return {"status": "ok"}

@app.get("/clubs", response_model=List[schemas.Club])
def get_clubs(db: Session = Depends(get_db)):
    return db.query(models.Club).order_by(models.Club.name).all()

@app.post("/generate_pools/{category}")
def generate_pools(category: str, db: Session = Depends(get_db)):
    cat = db.query(models.Category).filter(models.Category.name == category).first()
    if not cat: raise HTTPException(status_code=404, detail="Category not found")
    
    participants = db.query(models.Participant).filter(models.Participant.category_id == cat.id).all()
    males = [p for p in participants if p.sex == 'M']
    females = [p for p in participants if p.sex == 'F']
    
    def distribute_pools(group, start_pool_num):
        if not group: return start_pool_num
        group.sort(key=lambda x: x.weight)
        n = len(group)
        num_pools = 1 if n < 3 or n == 5 else (n + 3) // 4
        base_size, extra = n // num_pools, n % num_pools
        idx, current_pool = 0, start_pool_num
        for i in range(num_pools):
            size = base_size + (1 if i < extra else 0)
            for p in group[idx : idx + size]: p.pool_number = current_pool
            current_pool, idx = current_pool + 1, idx + size
        return current_pool

    next_pool_num = distribute_pools(males, 1)
    distribute_pools(females, next_pool_num)
    db.commit()
    return {"message": "Pools generated"}

@app.get("/fights", response_model=List[schemas.Fight])
def get_fights(category: Optional[str] = None, pool_number: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Fight)
    if category or pool_number is not None:
        query = query.join(models.Participant, models.Fight.fighter1_id == models.Participant.id)
    if category:
        query = query.join(models.Category).filter(models.Category.name == category)
    if pool_number is not None:
        query = query.filter(models.Participant.pool_number == pool_number)
    return query.order_by(models.Fight.id).all()

@app.post("/fights", response_model=List[schemas.Fight])
def create_fights(fights: List[schemas.FightCreate], db: Session = Depends(get_db)):
    new_fights = []
    for f in fights:
        data = f.dict()
        db_fight = models.Fight(**data)
        db.add(db_fight)
        new_fights.append(db_fight)
    db.commit()
    for f in new_fights: db.refresh(f)
    return new_fights

@app.put("/fights/{fight_id}", response_model=schemas.Fight)
def update_fight(fight_id: int, fight_update: schemas.FightUpdate, db: Session = Depends(get_db)):
    db_fight = db.query(models.Fight).filter(models.Fight.id == fight_id).first()
    if not db_fight: raise HTTPException(status_code=404, detail="Fight not found")
    for key, value in fight_update.dict(exclude_unset=True).items(): setattr(db_fight, key, value)
    db.commit()
    db.refresh(db_fight)
    return db_fight

@app.delete("/fights/{fight_id}")
def delete_fight(fight_id: int, db: Session = Depends(get_db)):
    db_fight = db.query(models.Fight).filter(models.Fight.id == fight_id).first()
    if not db_fight: raise HTTPException(status_code=404, detail="Fight not found")
    db.delete(db_fight)
    db.commit()
    return {"message": "Fight deleted"}

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    included_cats = db.query(models.Category).filter(models.Category.include_in_stats == True).all()
    cat_ids = [c.id for c in included_cats]
    participants = db.query(models.Participant).filter(models.Participant.category_id.in_(cat_ids)).all()
    if not participants: return {"by_club": [], "warnings": []}
    
    p_ids = [p.id for p in participants]
    fights = db.query(models.Fight).filter(models.Fight.fighter1_id.in_(p_ids) | models.Fight.fighter2_id.in_(p_ids)).all()
    stats_map = calculate_stats(participants, fights)
    
    for p in participants:
        p.score = stats_map[p.id]["score"]
        p.victories = stats_map[p.id]["victories"]
    
    data = [{"club": p.club.name if p.club else "Inconnu", "score": p.score, "victories": p.victories} for p in participants]
    df = pd.DataFrame(data)
    stats = df.groupby('club').agg(total_score=('score', 'sum'), total_victories=('victories', 'sum'), count=('club', 'count')).reset_index().to_dict(orient='records')
    
    warnings = []
    for p in participants:
        if p.score == 0 and not stats_map[p.id]["has_fights"]:
            p.category_name = p.category.name if p.category else ""
            p.club_name = p.club.name if p.club else ""
            warnings.append(p)
            
    return {"by_club": stats, "warnings": warnings}

@app.get("/configuration/{key}")
def get_config(key: str, db: Session = Depends(get_db)):
    config = db.query(models.Configuration).filter(models.Configuration.key == key).first()
    return {"value": config.value if config else None}

@app.post("/configuration")
def update_config(config: schemas.ConfigUpdate, db: Session = Depends(get_db)):
    db_config = db.query(models.Configuration).filter(models.Configuration.key == config.key).first()
    if db_config: db_config.value = config.value
    else: db.add(models.Configuration(key=config.key, value=config.value))
    db.commit()
    return {"status": "ok"}

@app.get("/pool_assignments", response_model=List[schemas.PoolAssignment])
def get_pool_assignments(db: Session = Depends(get_db)):
    assignments = db.query(models.PoolAssignment).options(joinedload(models.PoolAssignment.category)).all()
    for a in assignments: a.category_name = a.category.name if a.category else ""
    return assignments

@app.post("/pool_assignments/batch")
def update_pool_assignments(assignments: List[schemas.PoolAssignmentBase], db: Session = Depends(get_db)):
    for a in assignments:
        existing = db.query(models.PoolAssignment).filter(models.PoolAssignment.category_id == a.category_id, models.PoolAssignment.pool_number == a.pool_number).first()
        if existing:
            existing.table_number, existing.order = a.table_number, a.order
        else: db.add(models.PoolAssignment(**a.dict()))
    db.commit()
    return {"status": "ok"}

@app.post("/pool_assignments/validate")
def validate_pool(validation: schemas.PoolValidation, db: Session = Depends(get_db)):
    existing = db.query(models.PoolAssignment).filter(models.PoolAssignment.category_id == validation.category_id, models.PoolAssignment.pool_number == validation.pool_number).first()
    if existing: 
        existing.validated = validation.validated
        db.add(existing)
    else:
        db.add(models.PoolAssignment(category_id=validation.category_id, pool_number=validation.pool_number, table_number=0, order=0, validated=validation.validated))
    db.commit()
    return {"status": "ok", "validated": validation.validated}

@app.get("/score_sheet/{category}")
def download_score_sheet(category: str, base_url: Optional[str] = None, db: Session = Depends(get_db)):
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib import colors, styles, pagesizes, units
    parts = db.query(models.Participant).join(models.Category).filter(models.Category.name == category).order_by(models.Participant.pool_number, models.Participant.weight).all()
    pools = {}
    for p in parts:
        if p.pool_number:
            if p.pool_number not in pools: pools[p.pool_number] = []
            pools[p.pool_number].append(p)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=pagesizes.A4)
    styles = styles.getSampleStyleSheet()
    elements = []
    for num in sorted(pools.keys()):
        elements.append(Paragraph(f"Catégorie: {category} - Poule {num}", styles['Title']))
        data = [["Nom", "Prénom", "Club", "Poids", "Score"]]
        for p in pools[num]: data.append([p.lastname, p.firstname, p.club.name if p.club else "", f"{p.weight} kg", "_______"])
        t = Table(data, colWidths=[4*units.cm, 4*units.cm, 5*units.cm, 2*units.cm, 3*units.cm])
        t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.grey), ('GRID', (0, 0), (-1, -1), 1, colors.black)]))
        elements.append(t)
        if base_url:
            url = f"{base_url}/score_poule/{quote(category)}/{num}"
            elements.append(Spacer(1, 1*units.cm))
            elements.append(Paragraph(f'<link href="{url}" color="blue"><u>Saisir les scores en ligne</u></link>', styles['Normal']))
        elements.append(PageBreak())
    doc.build(elements)
    buffer.seek(0)
    return FileResponse(buffer, media_type='application/pdf', filename=f"Feuille_{category}.pdf")

@app.get("/debug/tables", response_class=HTMLResponse)
def debug_tables(db: Session = Depends(get_db)):
    from sqlalchemy import inspect, text
    inspector = inspect(db.get_bind())
    tables = inspector.get_table_names()
    stats = {}
    for table in tables:
        try:
            count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            stats[table] = count
        except Exception as e:
            stats[table] = str(e)
            
    html_content = """
    <html>
        <head>
            <title>Database Debug</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 2rem; }
                table { border-collapse: collapse; width: 100%; max-width: 600px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { bg-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
        </head>
        <body>
            <h1>Database Tables</h1>
            <table>
                <tr><th>Table Name</th><th>Row Count</th></tr>
    """
    
    for table, count in stats.items():
        html_content += f"<tr><td>{table}</td><td>{count}</td></tr>"
        
    html_content += """
            </table>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/debug/view", response_class=HTMLResponse)
def debug_view(db: Session = Depends(get_db)):
    html = """<html><head><title>Judo DB Debug</title><style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #f4f4f9; color: #333; }
    h1 { color: #2c3e50; }
    h2 { border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 40px; color: #2c3e50; }
    table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 14px; }
    th { background: #3498db; color: white; font-weight: 600; text-transform: uppercase; font-size: 12px; }
    tr:nth-child(even) { background-color: #f8f9fa; }
    tr:hover { background-color: #e9ecef; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .badge-blue { background: #e3f2fd; color: #1565c0; }
    .badge-green { background: #e8f5e9; color: #2e7d32; }
    </style></head><body><h1>Contenu de la Base de Données</h1>"""

    # Helper for name
    def p_name(p):
        if not p: return '<span style="color:#ccc">-</span>'
        return f"<b>{p.lastname}</b> {p.firstname}"

    # 1. Configuration
    configs = db.query(models.Configuration).all()
    html += "<h2>Configuration</h2><table><tr><th>Clé</th><th>Valeur</th></tr>"
    for c in configs: html += f"<tr><td>{c.key}</td><td>{c.value}</td></tr>"
    html += "</table>"

    # 2. Clubs
    clubs = db.query(models.Club).order_by(models.Club.name).all()
    html += f"<h2>Clubs ({len(clubs)})</h2><table><tr><th>ID</th><th>Nom</th></tr>"
    for c in clubs: html += f"<tr><td>{c.id}</td><td>{c.name}</td></tr>"
    html += "</table>"

    # 3. Categories
    cats = db.query(models.Category).order_by(models.Category.birth_year_min).all()
    html += f"<h2>Catégories ({len(cats)})</h2><table><tr><th>ID</th><th>Nom</th><th>Année Min</th><th>Année Max</th></tr>"
    for c in cats: html += f"<tr><td>{c.id}</td><td>{c.name}</td><td>{c.birth_year_min}</td><td>{c.birth_year_max}</td></tr>"
    html += "</table>"

    # 4. Participants (Joined)
    parts = db.query(models.Participant).options(joinedload(models.Participant.category), joinedload(models.Participant.club)).order_by(models.Participant.lastname).all()
    # Create lookup for fights
    p_map = {p.id: p for p in parts}

    html += f"<h2>Participants ({len(parts)})</h2><table><tr><th>ID</th><th>Nom Prénom</th><th>Sexe</th><th>Année</th><th>Poids</th><th>Club</th><th>Catégorie</th><th>Poule</th></tr>"
    for p in parts:
        c_name = p.category.name if p.category else "-"
        cl_name = p.club.name if p.club else "-"
        sex_badge = f'<span class="badge badge-blue">M</span>' if p.sex == 'M' else f'<span class="badge badge-green">F</span>'
        html += f"<tr><td>{p.id}</td><td>{p_name(p)}</td><td>{sex_badge}</td><td>{p.birth_year}</td><td>{p.weight}</td><td>{cl_name}</td><td>{c_name}</td><td>{p.pool_number}</td></tr>"
    html += "</table>"

    # 5. Pool Assignments
    assigns = db.query(models.PoolAssignment).options(joinedload(models.PoolAssignment.category)).order_by(models.PoolAssignment.table_number).all()
    html += f"<h2>Affectation Tables ({len(assigns)})</h2><table><tr><th>Catégorie</th><th>Poule</th><th>Table</th><th>Ordre</th><th>Validé</th></tr>"
    for a in assigns:
        cat_name = a.category.name if a.category else "-"
        html += f"<tr><td>{cat_name}</td><td>{a.pool_number}</td><td>{a.table_number}</td><td>{a.order}</td><td>{a.validated}</td></tr>"
    html += "</table>"

    # 6. Fights
    fights = db.query(models.Fight).all()
    html += f"<h2>Combats ({len(fights)})</h2><table><tr><th>ID</th><th>Combattant 1</th><th>Score 1</th><th>Combattant 2</th><th>Score 2</th><th>Vainqueur</th></tr>"
    for f in fights:
        p1 = p_map.get(f.fighter1_id)
        p2 = p_map.get(f.fighter2_id)
        w = p_map.get(f.winner_id)
        html += f"<tr><td>{f.id}</td><td>{p_name(p1)}</td><td>{f.score1}</td><td>{p_name(p2)}</td><td>{f.score2}</td><td>{p_name(w)}</td></tr>"
    html += "</table>"

    # 7. Preregistrations
    prereg = get_preregistrations(db)
    html += f"<h2>Pré-inscriptions ({len(prereg)})</h2><table><tr><th>Nom</th><th>Prénom</th><th>Sexe</th><th>Année</th><th>Poids</th><th>Club</th><th>Catégorie (Déduite)</th></tr>"
    for p in prereg:
        sex_badge = f'<span class="badge badge-blue">M</span>' if p.get('sex') == 'M' else f'<span class="badge badge-green">F</span>'
        html += f"<tr><td>{p.get('lastname')}</td><td>{p.get('firstname')}</td><td>{sex_badge}</td><td>{p.get('birth_year')}</td><td>{p.get('weight')}</td><td>{p.get('club_name')}</td><td>{p.get('category_name')}</td></tr>"
    html += "</table>"

    html += "</body></html>"
    return HTMLResponse(content=html)