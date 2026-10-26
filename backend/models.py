from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Business(Base):
    __tablename__ = "businesses"
    
    id = Column(Integer, primary_key=True, index=True)
    place_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    last_analyzed = Column(DateTime(timezone=True), server_default=func.now())
    
    reviews = relationship("Review", back_populates="business", cascade="all, delete-orphan")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String)
    polarity = Column(Float)
    health_score = Column(Float)
    business_id = Column(Integer, ForeignKey("businesses.id"))
    
    business = relationship("Business", back_populates="reviews")