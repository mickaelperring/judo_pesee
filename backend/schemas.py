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
    score: Optional[int] = None
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
    score: Optional[int] = None
    hors_categorie: Optional[bool] = None

class Participant(ParticipantBase):
    id: int

    class Config:
        orm_mode = True

class PoolAssignmentBase(BaseModel):
    category: str
    pool_number: int
    table_number: int
    order: int

class PoolAssignmentCreate(PoolAssignmentBase):
    pass

class PoolAssignment(PoolAssignmentBase):
    id: int

    class Config:
        orm_mode = True

class ConfigUpdate(BaseModel):
    key: str
    value: str
