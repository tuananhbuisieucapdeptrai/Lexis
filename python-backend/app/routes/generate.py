from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.services.summary import generate_summary
from app.services.flashcards import generate_flashcards
from app.services.quiz import generate_quiz
from app.services.concepts import generate_concepts
from app.db import get_chunks_by_document, save_concept, save_flashcards, save_quiz, save_summary
import os
import traceback


router = APIRouter()

class ProcessRequest(BaseModel):
    document_id: str
    user_id: str


@router.post("/generate/summary")
async def create_summary(
    payload: ProcessRequest,
    x_internal_secret: str = Header(None)
):
    if x_internal_secret != os.getenv("INTERNAL_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        document_id = payload.document_id
        user_id = payload.user_id
        chunks = get_chunks_by_document(document_id)
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks found for this document")
        summary = generate_summary(chunks)
        save_summary(document_id, user_id, summary)

        return { "status": "ok", "summary": summary }

    except HTTPException:
        raise

    except Exception as e:
        print(f"Error generating summary for {payload.document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")
    


@router.post("/generate/flashcards")
async def create_flashcards(
    payload: ProcessRequest,
    x_internal_secret: str = Header(None)
):
    if x_internal_secret != os.getenv("INTERNAL_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        document_id = payload.document_id
        user_id = payload.user_id
        chunks = get_chunks_by_document(document_id)
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks found for this document")
        flashcards = generate_flashcards(chunks)
        for flashcard in flashcards:
            save_flashcards(document_id, user_id, flashcard)

        return { "status": "ok", "flashcards": flashcards }

    except HTTPException:
        raise

    except Exception as e:
        print(f"Error generating flashcards for {payload.document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Flashcards generation failed: {str(e)}")
    


@router.post("/generate/quiz")
async def create_quiz(
    payload: ProcessRequest,
    x_internal_secret: str = Header(None)
):
    if x_internal_secret != os.getenv("INTERNAL_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        document_id = payload.document_id
        user_id = payload.user_id
        chunks = get_chunks_by_document(document_id)
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks found for this document")
        quiz = generate_quiz(chunks)
        for question in quiz:
            save_quiz(document_id, user_id, question)

        return { "status": "ok", "quiz": quiz }

    except HTTPException:
        raise

    except Exception as e:
        print(f"Error generating quiz for {payload.document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")
    





@router.post("/generate/concepts")
async def create_concepts(
    payload: ProcessRequest,
    x_internal_secret: str = Header(None)
):
    if x_internal_secret != os.getenv("INTERNAL_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        document_id = payload.document_id
        user_id = payload.user_id
        chunks = get_chunks_by_document(document_id)
        if not chunks:
            raise HTTPException(status_code=404, detail="No chunks found for this document")
        concepts = generate_concepts(chunks)
        save_errors = []
        for concept in concepts:
            try:
                save_concept(document_id, user_id, concept)
            except Exception as e:
                save_errors.append(f"{concept.get('concept', 'Unknown concept')}: {str(e)}")

        if save_errors:
            raise RuntimeError("; ".join(save_errors))

        return { "status": "ok", "concepts": concepts }

    except HTTPException:
        raise

    except Exception as e:
        print(f"Error generating concepts for {payload.document_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Concepts generation failed: {str(e)}")
    
