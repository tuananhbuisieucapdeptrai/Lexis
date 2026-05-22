from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.db import get_document, update_chunks, update_document_status, get_storage_url
from app.services.text import extract_text, split_into_chunks
import os




router = APIRouter()

class ProcessRequest(BaseModel):
    document_id: str

@router.post("/process")
async def process_document(
    payload: ProcessRequest,
    x_internal_secret: str = Header(None)
):
    if x_internal_secret != os.getenv("INTERNAL_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden")

    document_id = payload.document_id

    try:
   
        document = get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        storage_url = get_storage_url(document["storage_path"])
        text = extract_text(document, storage_url)
        chunks = split_into_chunks(text)
        update_chunks(chunks, document_id)
        update_document_status(document_id, "ready")

        return { "status": "ok", "chunk_count": len(chunks) }

    except HTTPException:
        raise

    except Exception as e:
        update_document_status(document_id, "failed")
        print(f"Error processing document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")