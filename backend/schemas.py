from pydantic import BaseModel
from typing import Optional, List

class ClubBase(BaseModel):
    name: str

class Club(ClubBase):
    id: int
    class Config:
        from_attributes = True

class CategoryBase(BaseModel):
    name: str
    include_in_stats: bool = True
    birth_year_min: Optional[int] = None
    birth_year_max: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    include_in_stats: Optional[bool] = None
    birth_year_min: Optional[int] = None
    birth_year_max: Optional[int] = None

class Category(CategoryBase):
    id: int
    class Config:
        from_attributes = True

class ParticipantBase(BaseModel):
    firstname: str
    lastname: str
    sex: str
    birth_year: int
    weight: float
    pool_number: Optional[int] = None
    hors_categorie: bool = False
    category_id: int
    club_id: int

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    sex: Optional[str] = None
    birth_year: Optional[int] = None
    weight: Optional[float] = None
    pool_number: Optional[int] = None
    hors_categorie: Optional[bool] = None
    category_id: Optional[int] = None
    club_id: Optional[int] = None

class Participant(ParticipantBase):
    id: int
    # Fields for frontend convenience, populated by join
    category_name: Optional[str] = None
    club_name: Optional[str] = None
    score: int = 0
    victories: int = 0
    has_fights: bool = False

    class Config:
        from_attributes = True

class FightBase(BaseModel):
    fighter1_id: int
    fighter2_id: int
    score1: int = 0
    score2: int = 0
    winner_id: Optional[int] = None

class FightCreate(FightBase):
    pass

class FightUpdate(BaseModel):
    score1: Optional[int] = None
    score2: Optional[int] = None
    winner_id: Optional[int] = None

class Fight(FightBase):
    id: int
    class Config:
        from_attributes = True

class PoolAssignmentBase(BaseModel):
    pool_number: int
    table_number: int
    order: int
    validated: bool = False
    category_id: int

class PoolAssignment(PoolAssignmentBase):
    id: int
    category_name: Optional[str] = None
    class Config:
        from_attributes = True

class ConfigUpdate(BaseModel):
    key: str
    value: str

class PoolValidation(BaseModel):
    category_id: int
    pool_number: int
    validated: bool = True