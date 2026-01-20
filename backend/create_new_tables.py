from database import engine
from models import Base

def create_tables():
    print("Creating new tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

if __name__ == "__main__":
    create_tables()
