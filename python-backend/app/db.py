import os
from supabase import create_client, Client
from app.model import get_embedding
import datetime
from dotenv import load_dotenv


load_dotenv() 

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)



def similarity_search(document_id: str, query_embedding: list, top_k: int = 5) -> list[dict]:
    response = supabase.rpc('match_chunks', {
        'query_embedding': query_embedding,
        'match_document_id': document_id,
        'match_count': top_k
    }).execute()
    return response.data


def get_storage_url(storage_path: str) -> str:
    response = supabase.storage\
        .from_("documents")\
        .create_signed_url(storage_path, 60)
    return response["signedURL"]





### <--- This is the list of methods to deal with document table ---> ###
def get_document(document_id):
    response = supabase.table('documents')\
        .select('*')\
        .eq('id', document_id)\
        .single()\
        .execute()
    return response.data

def update_document_status(document_id, status):
    supabase.table('documents').update(
        { 'status': status }
    ).eq('id', document_id).execute()

#def update_document()



### <--- This is the list of methods to deal with the chunks table  ---> ###
def get_chunks(chunk_id):
    return supabase.table('chunks')\
        .select('*')\
        .eq("id", chunk_id)\
        .single()\
        .execute()

def get_chunks_by_document(document_id):
    response = supabase.table('chunks')\
        .select('*')\
        .eq("document_id", document_id)\
        .order("chunk_index")\
        .execute()
    return response.data

def update_chunks(chunks: list[str], document_id: str):
    rows = []
    for index, chunk in enumerate(chunks):
        embedding = get_embedding(chunk)
        rows.append({
            "document_id": document_id,
            "content": chunk,
            "embedding": embedding,
            "chunk_index": index
        })
    supabase.table("chunks").insert(rows).execute()





# <--- This is the list of methods to work with the conversations table  --->#
def get_conversation_history(document_id: str, user_id: str, limit:int = 6):
    response = supabase.table('conversations')\
        .select("role, content")\
        .eq("user_id", user_id)\
        .eq("document_id", document_id)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()
    return list(reversed(response.data))


def save_message(document_id: str, user_id: str, role: str, message: str):
    object = {
        "document_id": document_id, 
        "user_id": user_id,
        "role": role,
        "content": message
    }
    supabase.table('conversations')\
    .insert(object)\
    .execute()





# <--- This is the list of methods to work with the key concepts table ---> #
def get_concepts_by_document(document_id: str):
    response = supabase.table('key_concepts')\
        .select("concept, explanation")\
        .eq("document_id", document_id)\
        .order("created_at")\
        .execute()
    return response.data

def save_concept(document_id: str, user_id: str, concept):
    if not isinstance(concept, dict):
        raise TypeError("Concept must be a dictionary")

    definition = concept.get("definition", "")
    explanation = concept.get("explanation", "")
    example = concept.get("example", "")
    importance = concept.get("importance", "")
    details = "\n\n".join(
        part for part in [
            definition,
            explanation,
            f"Example: {example}" if example else "",
            f"Why it matters: {importance}" if importance else "",
        ]
        if part
    )

    object = {
        "document_id": document_id,
        "user_id": user_id,
        "concept": concept.get("concept", "Untitled concept"),
        "explanation": details or explanation
    }

    supabase.table('key_concepts')\
        .insert(object)\
        .execute()
    




#<--- This is the list of methods to work with the flashcards table --->#
def get_flashcards_by_document(document_id: str):
    response = supabase.table('flashcards')\
        .select("front, back")\
        .eq("document_id", document_id)\
        .order("created_at")\
        .execute()
    return response.data

def save_flashcards(document_id: str, user_id: str, flashcard):
        object = {
            "document_id": document_id, 
            "user_id": user_id,
            "front": flashcard["front"],
            "back": flashcard["back"]
        }
        supabase.table('flashcards')\
            .insert(object)\
            .execute()







#<--- This is the list of method to work with the quiz questions table --->#
def get_quiz_questions_by_document(document_id: str):
    response = supabase.table('quiz_questions')\
        .select("question, options, correct_answer, explanation")\
        .eq("document_id", document_id)\
        .order("created_at")\
        .execute()
    return response.data



def save_quiz(document_id: str, user_id: str, question):
    object = {
            "document_id": document_id,
            "user_id": user_id,
            "question": question["question"],
            "options": question["options"],
            "correct_answer": question["correct_answer"],
            "explanation": question["explanation"]
        }
    supabase.table('quiz_questions')\
        .insert(object)\
        .execute()
    





#<--- This is the list of methods to work with the summary table  --->#
def get_summary_by_document(document_id: str):
    response = supabase.table('summaries')\
        .select("content")\
        .eq("document_id", document_id)\
        .order("created_at")\
        .execute()
    return response.data

def save_summary(document_id: str, user_id: str, summary):
    object = {
        "document_id": document_id,
        "user_id": user_id,
        "content": summary
    }
    supabase.table("summaries")\
        .insert(object)\
        .execute()
