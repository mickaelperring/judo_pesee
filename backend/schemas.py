from pydantic import BaseModel
from typing import Optional

class ParticipantBase(BaseModel):
    category: str
    firstname: str
    lastname: str
    sex: str
    birth_year: int
    club: str
    weight: float
    pool_number: Optional[int] = None
    hors_categorie: bool = False

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantUpdate(BaseModel):
    category: Optional[str] = None
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    sex: Optional[str] = None
    birth_year: Optional[int] = None
    club: Optional[str] = None
    weight: Optional[float] = None
    pool_number: Optional[int] = None
    hors_categorie: Optional[bool] = None

class Participant(ParticipantBase):
    id: int
    score: int = 0
    victories: int = 0
    has_fights: bool = False

    class Config:
        orm_mode = True

class FightBase(BaseModel):
    category: str
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
        orm_mode = True

class PoolAssignmentBase(BaseModel):
    category: str
    pool_number: int
    table_number: int
    order: int
    validated: bool = False

class PoolAssignmentCreate(PoolAssignmentBase):
    pass

class PoolAssignment(PoolAssignmentBase):
    id: int

    class Config:
        orm_mode = True

class ConfigUpdate(BaseModel):

    key: str

    value: str



class PoolValidation(BaseModel):

    category: str

    pool_number: int

    validated: bool = True

class CategoryBase(BaseModel):
    name: str
    include_in_stats: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    include_in_stats: Optional[bool] = None

class Category(CategoryBase):
    id: int

    class Config:
        from_attributes = True
