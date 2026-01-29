from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Club(Base):
    __tablename__ = "clubs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    participants = relationship("Participant", back_populates="club")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    include_in_stats = Column(Boolean, default=True)
    birth_year_min = Column(Integer, nullable=True)
    birth_year_max = Column(Integer, nullable=True)

    participants = relationship("Participant", back_populates="category", cascade="all, delete-orphan")
    pool_assignments = relationship("PoolAssignment", back_populates="category", cascade="all, delete-orphan")

class Participant(Base):
    __tablename__ = "participants"
    id = Column(Integer, primary_key=True, index=True)
    firstname = Column(String)
    lastname = Column(String)
    sex = Column(String)
    birth_year = Column(Integer)
    weight = Column(Float)
    pool_number = Column(Integer, nullable=True)
    hors_categorie = Column(Boolean, default=False)
    
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"))
    club_id = Column(Integer, ForeignKey("clubs.id", ondelete="SET NULL"), nullable=True)

    category = relationship("Category", back_populates="participants")
    club = relationship("Club", back_populates="participants")
    fights_as_p1 = relationship("Fight", foreign_keys="[Fight.fighter1_id]", cascade="all, delete-orphan")
    fights_as_p2 = relationship("Fight", foreign_keys="[Fight.fighter2_id]", cascade="all, delete-orphan")

class Fight(Base):
    __tablename__ = "fights"
    id = Column(Integer, primary_key=True, index=True)
    fighter1_id = Column(Integer, ForeignKey("participants.id", ondelete="CASCADE"))
    fighter2_id = Column(Integer, ForeignKey("participants.id", ondelete="CASCADE"))
    score1 = Column(Integer, default=0)
    score2 = Column(Integer, default=0)
    winner_id = Column(Integer, ForeignKey("participants.id", ondelete="CASCADE"), nullable=True)

class PoolAssignment(Base):
    __tablename__ = "pool_assignments"
    id = Column(Integer, primary_key=True, index=True)
    pool_number = Column(Integer)
    table_number = Column(Integer) # 1 to N
    order = Column(Integer)
    validated = Column(Boolean, default=False)
    
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"))
    category = relationship("Category", back_populates="pool_assignments")

class Configuration(Base):
    __tablename__ = "configuration"
    key = Column(String, primary_key=True)
    value = Column(String)
