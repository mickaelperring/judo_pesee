from sqlalchemy import Column, Integer, String, Float, Boolean
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
    score = Column(Integer, default=None, nullable=True)
    hors_categorie = Column(Boolean, default=False)

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
