<div align="center">

# Instant Review

**Google Maps reviews, scored and charted, for small business owners.**

![React](https://img.shields.io/badge/React_19-Vite-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/status-Phase_1-blue)

</div>

Instant Review is a business intelligence tool for small business owners. Type in a business name and it pulls that business's Google Maps reviews, scores each one for sentiment with TextBlob, and puts the results on one dashboard.

You get a feel for what customers think of a business without having to read every review.

> **Status:** Phase 1, the working MVP. Phases 2–4 are still to come, and the [roadmap](#roadmap) has the plan.

<!--
  Screenshot: save an image of the dashboard as docs/screenshots/dashboard.png,
  then replace this comment with:
  ![Instant Review dashboard](docs/screenshots/dashboard.png)
-->

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Health Score](#health-score)
- [Project structure](#project-structure)
- [Running it locally](#running-it-locally)
- [API](#api)
- [Database](#database)
- [Roadmap](#roadmap)
- [Known limitations](#known-limitations)
- [Security notes](#security-notes)

## Features

- Search for a business by name and get its sentiment report back in one request.
- The backend pulls reviews live from the Google Maps Places API.
- Each review gets a TextBlob polarity score and a 0–100 Health Score.
- The dashboard has the overall score, a pie chart of positive, neutral and negative reviews, a bar chart of each review's score, and color-coded review cards.
- Results are saved in PostgreSQL. Search for the same business again and the backend skips Google, which is faster and doesn't spend any API calls.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 3, Recharts |
| Backend | Python, FastAPI, Uvicorn, Requests |
| Database | PostgreSQL, SQLAlchemy |
| NLP | TextBlob |
| External API | Google Maps Places API (Find Place and Place Details) |
| Config | python-dotenv |

## How it works

```mermaid
flowchart LR
    A[React dashboard] -->|GET /fetch-and-analyze| B[FastAPI backend]
    B --> C{Business already<br/>in PostgreSQL?}
    C -->|Yes| F[Return JSON]
    C -->|No| D[Google Places API<br/>Find Place, then Place Details]
    D --> E[TextBlob<br/>sentiment scoring]
    E --> G[(PostgreSQL)]
    G --> F
    F --> A
```

1. You enter a business name, say `Starbucks`, and the frontend calls `GET /fetch-and-analyze?business_name=Starbucks`.
2. The backend looks in PostgreSQL for a saved business whose name contains that text (a case-insensitive `ILIKE` match). If it finds one, it returns the saved reviews straight away.
3. If not, it asks Google's **Find Place** endpoint for the business's `place_id`, then asks **Place Details** for its reviews.
4. It strips the few HTML tags Google leaves in review text (`<br />`, `<b>`), scores each review with TextBlob, and converts the polarity to a Health Score.
5. The business and its reviews go into PostgreSQL, and the backend sends the results back as JSON.
6. The React app draws the dashboard.

## Health Score

TextBlob gives each review a polarity from `-1.0` (very negative) to `1.0` (very positive). The backend turns that into a 0–100 score:

```
Health Score = ((polarity + 1) / 2) × 100
```

A polarity of `0.6` becomes `80`. A polarity of `0` becomes `50`. The business's overall score uses the same formula on the average polarity of all its reviews.

The dashboard then labels each review by its Health Score. The cut-offs live in `frontend/src/App.tsx`:

| Health Score | Label | Same thing as polarity |
| --- | --- | --- |
| 70 and up | Positive | 0.4 and up |
| 40 to under 70 | Neutral | -0.2 to under 0.4 |
| Below 40 | Negative | below -0.2 |

## Project structure

```
customer_review_aggregator/
├── backend/
│   ├── main.py            # FastAPI app: the endpoint, Google API calls, TextBlob scoring, caching
│   ├── database.py        # PostgreSQL connection and the get_db session
│   ├── models.py          # Business and Review tables
│   └── .gitignore         # keeps .env, venv/ and __pycache__/ out of Git
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # search bar, Health Score, charts, review cards
│   │   ├── main.tsx
│   │   └── index.css      # Tailwind setup
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
└── README.md
```

## Running it locally

### What you need

- Python 3.10 or newer
- Node.js 20.19 or newer (Vite 8 needs it)
- PostgreSQL
- A Google Cloud API key with the Places API turned on. The backend calls Google's original Find Place and Place Details endpoints, which Google now calls **Places API (Legacy)**. That's the API your key needs.

### 1. Get the code

```bash
git clone https://github.com/btwitsamal/customer_review_aggregator.git
cd customer_review_aggregator
```

### 2. Create the database

Create an empty database called `instant_review_db`, either in pgAdmin or from a terminal:

```bash
psql -U postgres -c "CREATE DATABASE instant_review_db;"
```

The backend connects with the connection string in `backend/database.py`:

```
postgresql://postgres:postgres@localhost:5432/instant_review_db
```

If your PostgreSQL username or password isn't `postgres`, change it there. You don't need to create any tables; the backend creates `businesses` and `reviews` the first time it starts.

### 3. Start the backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install fastapi uvicorn sqlalchemy "psycopg[binary]" requests python-dotenv textblob
```

Create a file called `.env` inside `backend/` with your Google key:

```
GOOGLE_API_KEY=your_google_api_key_here
```

Then run:

```bash
python main.py
```

The API is now running at http://127.0.0.1:8001. FastAPI's interactive docs are at http://127.0.0.1:8001/docs.

### 4. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Go to http://localhost:5173 and search for a business. The frontend calls the API at `http://127.0.0.1:8001` (it's set in `src/App.tsx`), so leave the backend running in the other terminal.

## API

### `GET /fetch-and-analyze`

Fetches, scores and caches the reviews for one business.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `business_name` | string | yes | The business to look up, for example `Starbucks` |

```bash
curl "http://127.0.0.1:8001/fetch-and-analyze?business_name=Starbucks"
```

Example response (sample reviews, real TextBlob scores):

```json
{
  "business_name": "Example Coffee House",
  "business_health_score": 62.0,
  "total_reviews": 2,
  "analyzed_reviews": [
    {
      "text": "Great coffee and really friendly staff. My favourite spot in town!",
      "polarity": 0.63,
      "health_score": 81.72
    },
    {
      "text": "The wait was far too long and my order was wrong.",
      "polarity": -0.15,
      "health_score": 42.5
    }
  ]
}
```

Errors:

| Status | When |
| --- | --- |
| `404` | Google can't find the business, or it has no reviews |
| `500` | The Google API key is missing, or Google returns an error |

## Database

**`businesses`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | primary key |
| `place_id` | string | Google's ID for the place, unique |
| `name` | string | business name as Google returns it |
| `last_analyzed` | timestamp | when the reviews were fetched |

**`reviews`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | primary key |
| `text` | string | the review text |
| `polarity` | float | TextBlob score, `-1.0` to `1.0`, rounded to 2 places |
| `health_score` | float | 0–100 |
| `business_id` | integer | links to `businesses.id` |

## Roadmap

Phase 1 is done. Phases 2 to 4 are what I'm planning next, and the details will probably shift as I build them.

### Phase 1: MVP (done)

- [x] React dashboard with Tailwind CSS and Recharts
- [x] FastAPI backend with CORS and `.env` support
- [x] Live reviews from the Google Maps Places API
- [x] TextBlob sentiment scoring and the Health Score
- [x] PostgreSQL caching with SQLAlchemy

### Phase 2: Better AI

- [ ] Swap TextBlob for a Hugging Face Transformers model (DistilBERT) that understands context
- [ ] Aspect-based sentiment, so service, price, cleanliness and so on get their own scores
- [ ] Pull out common keywords and themes from reviews

### Phase 3: More data

- [ ] Get more than five reviews per business, for example through the Google Business Profile API for owners' own listings
- [ ] Cache by `place_id` with an expiry date, and refresh on a schedule
- [ ] Track sentiment over time
- [ ] Compare a business with nearby competitors
- [ ] Move to Google's Places API (New)

### Phase 4: Production

- [ ] User accounts and login
- [ ] Docker setup
- [ ] Cloud deployment, with the database URL and API address moved into environment settings
- [ ] Automated tests and CI with GitHub Actions
- [ ] Alerts when a new negative review comes in

## Known limitations

- Google's Places API returns at most five reviews per place, so the dashboard shows a sample, not a business's full review history.
- The cache lookup uses `ILIKE '%name%'`, which matches partial names: searching `Star` can return a saved `Starbucks`. Chains with lots of branches end up sharing one cached result.
- Cached results never expire. `last_analyzed` gets saved, but nothing checks it yet, so once a business is stored it's never fetched again.
- When Google finds several matching places, the backend takes the first one.
- TextBlob scores words, not meaning, so it misses sarcasm and context. "The wait was far too long and my order was wrong." scores 42.5, which the dashboard calls Neutral. Fixing that is the main job of Phase 2.
- Everything is set up for localhost. The API address and database connection are hard-coded, and CORS allows any origin.
- Google Maps Platform terms limit how long you can store most Places content. Check them before putting this online.

## Security notes

- The Google API key lives in `backend/.env`, which `backend/.gitignore` keeps out of Git.
- The key is only used by the backend. Don't move it into the frontend: anything in a Vite `VITE_` variable is visible to every visitor.
- In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), restrict the key to the Places API.

---

<div align="center">

Built by [btwitsamal](https://github.com/btwitsamal)

</div>
