from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import auth, analyze, apikeys, scalp
from core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://app.fraudshield.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(apikeys.router)
app.include_router(scalp.router)

@app.on_event("startup")
async def startup():
    # Créer les tables du module anti-scalping
    from database import engine
    from scalp_models import Base as ScalpBase
    ScalpBase.metadata.create_all(bind=engine)
    init_db()
    print(f"✅ {settings.APP_NAME} v{settings.VERSION} démarré")

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.VERSION}
