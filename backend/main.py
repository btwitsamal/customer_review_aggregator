from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from textblob import TextBlob
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import requests
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from datetime import datetime

# Import our database files
from database import engine, get_db, Base
from models import Business, Review

# Create database tables
Base.metadata.create_all(bind=engine)

# Load the API key
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

app = FastAPI(title="Instant Review API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

class AnalyzedReview(BaseModel):
    text: str
    polarity: float
    health_score: float

class DashboardResponse(BaseModel):
    business_name: str
    business_health_score: float
    total_reviews: int
    analyzed_reviews: List[AnalyzedReview]

@app.get("/fetch-and-analyze", response_model=DashboardResponse)
def fetch_and_analyze(business_name: str = Query(..., description="Name of the business"), db: Session = Depends(get_db)):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Google API Key not found in .env file")

    # --- STEP 1: Check if we already have this business in the database ---
    existing_business = db.query(Business).filter(Business.name.ilike(f"%{business_name}%")).first()
    
    if existing_business:
        print(f"✅ Found '{business_name}' in database! Loading cached data...")
        # Load reviews from database
        db_reviews = db.query(Review).filter(Review.business_id == existing_business.id).all()
        
        analyzed_reviews = [
            AnalyzedReview(
                text=review.text,
                polarity=review.polarity,
                health_score=review.health_score
            )
            for review in db_reviews
        ]
        
        # Calculate overall score
        total_polarity = sum(r.polarity for r in db_reviews)
        avg_polarity = total_polarity / len(db_reviews) if db_reviews else 0
        overall_health_score = ((avg_polarity + 1) / 2) * 100
        
        return DashboardResponse(
            business_name=existing_business.name,
            business_health_score=round(overall_health_score, 2),
            total_reviews=len(db_reviews),
            analyzed_reviews=analyzed_reviews
        )

    # --- STEP 2: Not in database - fetch from Google Maps ---
    print(f"🔍 '{business_name}' not in database. Fetching from Google Maps...")
    
    find_place_url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    find_place_params = {
        "input": business_name,
        "inputtype": "textquery",
        "fields": "place_id,name",
        "key": GOOGLE_API_KEY
    }
    
    try:
        find_response = requests.get(find_place_url, params=find_place_params).json()
        
        if find_response.get("status") != "OK":
            error_msg = find_response.get("error_message", find_response.get("status"))
            raise HTTPException(status_code=500, detail=f"Google API Error: {error_msg}")
            
        if not find_response.get("candidates"):
            raise HTTPException(status_code=404, detail=f"Business '{business_name}' not found on Google Maps.")

        place_id = find_response["candidates"][0]["place_id"]
        actual_business_name = find_response["candidates"][0].get("name", business_name)

        # Get Place Details (Reviews)
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        details_params = {
            "place_id": place_id,
            "fields": "name,rating,reviews",
            "key": GOOGLE_API_KEY
        }

        details_response = requests.get(details_url, params=details_params).json()

        if details_response.get("status") != "OK":
            error_msg = details_response.get("error_message", details_response.get("status"))
            raise HTTPException(status_code=500, detail=f"Google API Error: {error_msg}")
            
        if "reviews" not in details_response.get("result", {}):
            raise HTTPException(status_code=404, detail=f"No reviews found for '{business_name}'.")

        google_reviews = details_response["result"]["reviews"]

        # --- STEP 3: Analyze Sentiment & Save to Database ---
        print(f"💾 Saving {len(google_reviews)} reviews to database...")
        
        # Create business entry
        new_business = Business(
            place_id=place_id,
            name=actual_business_name,
            last_analyzed=datetime.utcnow()
        )
        db.add(new_business)
        db.commit()
        db.refresh(new_business)
        
        analyzed_reviews = []
        total_polarity = 0.0

        for review in google_reviews:
            text = review.get("text", "")
            text = text.replace("<br />", " ").replace("<b>", "").replace("</b>", "")
            
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            health_score = ((polarity + 1) / 2) * 100 

            # Create review entry
            new_review = Review(
                text=text,
                polarity=round(polarity, 2),
                health_score=round(health_score, 2),
                business_id=new_business.id
            )
            db.add(new_review)
            
            analyzed_reviews.append(AnalyzedReview(
                text=text,
                polarity=round(polarity, 2),
                health_score=round(health_score, 2)
            ))
            total_polarity += polarity

        db.commit()
        
        avg_polarity = total_polarity / len(analyzed_reviews)
        overall_health_score = ((avg_polarity + 1) / 2) * 100

        print("✅ Data saved successfully!")
        
        return DashboardResponse(
            business_name=actual_business_name,
            business_health_score=round(overall_health_score, 2),
            total_reviews=len(analyzed_reviews),
            analyzed_reviews=analyzed_reviews
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)