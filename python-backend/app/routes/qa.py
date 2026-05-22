from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.model import generate, get_embedding
from app.db import similarity_search, get_conversation_history, save_message
from app.services.qa_prompt import build_qa_prompt
import os
import re

router = APIRouter()

class QaRequest(BaseModel):
    question: str
    document_id: str
    user_id: str


def clean_chat_answer(answer: str) -> str:
    answer = re.sub(r"(?m)^#{1,6}\s*", "", answer)
    answer = re.sub(r"\*\*(.*?)\*\*", r"\1", answer)
    answer = re.sub(r"__(.*?)__", r"\1", answer)
    answer = re.sub(r"(?m)^\s*[-*•]\s+", "", answer)
    answer = re.sub(r"(?m)^\s*\d+\.\s+", "", answer)
    answer = re.sub(r"(?m)^\s*-{3,}\s*$", "", answer)
    answer = re.sub(r"\n{3,}", "\n\n", answer)
    return answer.strip()




@router.post("/qa")
async def answer_question(
    payload: QaRequest,
    x_internal_secret: str = Header(None)
):
    if x_internal_secret != os.getenv("INTERNAL_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        document_id = payload.document_id
        question = payload.question
        user_id = payload.user_id
        embed_question = get_embedding(question)
        chunks = similarity_search(document_id, embed_question)
        context = "\n\n".join([chunk["content"] for chunk in chunks])
        history = get_conversation_history(document_id, user_id, limit=6)
        prompt = build_qa_prompt(context, history, question)
        answer = clean_chat_answer(generate(prompt, max_tokens=1000))
        save_message(document_id, user_id, "user", question)
        save_message(document_id, user_id, "assistant", answer)
        return {
            "answer": answer,
            "sources": [
                {
                    "chunk_index": c["chunk_index"],
                    "content": c["content"]
                }
                for c in chunks
            ]
        }


    except HTTPException:
        raise

    except Exception as e:
        print(f"Error answering question {payload.question}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Answering question failed: {str(e)}")
