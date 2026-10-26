from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# This connects to the database you just made in pgAdmin
# Format: postgresql://username:password@localhost:port/database_name
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/instant_review_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# This function helps FastAPI get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()