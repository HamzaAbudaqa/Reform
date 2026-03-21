import logging
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.analyze_competitors import router as competitors_router
from app.routes.discover_competitors import router as discovery_router
from app.routes.transform_ui import router as transform_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="RefineUI Analysis Service",
    description="TinyFish-powered competitor UI/UX analysis for RefineUI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://refineui-chi.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(competitors_router)
app.include_router(discovery_router)
app.include_router(transform_router)


@app.get("/health")
def health():
    return {"status": "ok"}
