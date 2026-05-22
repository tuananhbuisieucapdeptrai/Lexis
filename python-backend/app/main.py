from fastapi import FastAPI
from dotenv import load_dotenv
from app.routes.process import router as process_router
from app.routes.generate import router as generate_router
from app.routes.qa import router as qa_router


load_dotenv()

app = FastAPI()

app.include_router(process_router)
app.include_router(generate_router)
app.include_router(qa_router)

@app.get("/health")
def health_check():
    return { "status": "ok" }








