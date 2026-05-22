import re
import requests
from app.model import extract_text_from_image
from app.services.pdf import extract_text_from_pdf

def extract_text(document, storage_url) -> str:
    print(f"Downloading from: {storage_url}")
    
    response = requests.get(storage_url)
    
    print(f"Status code: {response.status_code}")
    print(f"Content length: {len(response.content)} bytes")
    print(f"Content type: {response.headers.get('content-type')}")
    
    if response.status_code != 200:
        raise Exception(f"Failed to download file: {response.status_code} - {response.text[:200]}")
    
    file_bytes = response.content
    mime_type = document['mime_type']

    if mime_type == "application/pdf":
        return extract_text_from_pdf(file_bytes)
    else:
        return extract_text_from_image(file_bytes, mime_type)
    
def split_into_chunks(text: str, max_words: int = 500, overlap_sentences: int = 2) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks = []
    current_sentences = []
    current_word_count = 0

    for sentence in sentences:
        sentence_word_count = len(sentence.split())

        if current_word_count + sentence_word_count > max_words and current_sentences:
            chunks.append(" ".join(current_sentences))
            current_sentences = current_sentences[-overlap_sentences:]
            current_word_count = sum(len(s.split()) for s in current_sentences)

        current_sentences.append(sentence)
        current_word_count += sentence_word_count

    if current_sentences:
        chunks.append(" ".join(current_sentences))

    return chunks




 