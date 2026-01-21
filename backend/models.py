from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from database import Base

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True)
    firstname = Column(String)
    lastname = Column(String)
    sex = Column(String)
    birth_year = Column(Integer)
    club = Column(String, index=True)
    weight = Column(Float)
    pool_number = Column(Integer, nullable=True)
    # score/victories removed, calculated from fights
    hors_categorie = Column(Boolean, default=False)

class Fight(Base):
    __tablename__ = "fights"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    pool_number = Column(Integer)
    order = Column(Integer)
    fighter1_id = Column(Integer, ForeignKey("participants.id"))
    fighter2_id = Column(Integer, ForeignKey("participants.id"))
    score1 = Column(Integer, default=0)
    score2 = Column(Integer, default=0)
    winner_id = Column(Integer, nullable=True)
    validated = Column(Boolean, default=False)

class PoolAssignment(Base):
    __tablename__ = "pool_assignments"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    pool_number = Column(Integer)
    table_number = Column(Integer) # 1 to N
    order = Column(Integer)

class Configuration(Base):
    __tablename__ = "configuration"

    key = Column(String, primary_key=True)
    value = Column(String)
