import os
import anthropic
import base64
from huggingface_hub import InferenceClient
import json
import numpy as np
from dotenv import load_dotenv
from PIL import Image
import io

load_dotenv()

claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

client = InferenceClient(
    provider="hf-inference",
    api_key=os.getenv("HF_TOKEN"),
)

'''
HF_TOKEN = os.getenv("HF_TOKEN")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
HF_API_URL = f"https://api-inference.huggingface.co/models/{EMBEDDING_MODEL}"
HF_HEADERS = { "Authorization": f"Bearer {HF_TOKEN}" }

def get_embedding(text: str) -> list[float]:
    response = requests.post(
        HF_API_URL,
        headers=HF_HEADERS,
        json={ "inputs": text }
    )
    response.raise_for_status()
    return response.json()
'''
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "ibm-granite/granite-embedding-97m-multilingual-r2")

def extract_embedding(raw):
    if raw is None:
        raise ValueError("Empty embedding response")


    if isinstance(raw, np.ndarray):
        if raw.ndim == 1:
            return raw
        elif raw.ndim == 2:
            return raw[0]
        else:
            raise ValueError(f"Unexpected ndarray shape: {raw.shape}")


    if isinstance(raw, list):
        arr = np.array(raw)

        if arr.ndim == 1:
            return arr
        elif arr.ndim == 2:
            return arr[0]

    if isinstance(raw, dict):
  
        for key in ["embeddings", "embedding", "data"]:
            if key in raw:
                return extract_embedding(raw[key])


    raise ValueError(f"Unsupported embedding response type: {type(raw)}")

def get_embedding(text: str)->list[float]:
    response = client.feature_extraction(
        text,
        model = EMBEDDING_MODEL
    )
   
    return extract_embedding(response).tolist()




def generate(prompt: str, max_tokens: int = 1000) -> str:
    response = claude.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=max_tokens,
        messages=[{ "role": "user", "content": prompt }]
    )
    return response.content[0].text

def compress_image(image_bytes: bytes, max_size_mb: float = 3.5) -> bytes:
    max_bytes = int(max_size_mb * 1024 * 1024)


    if len(image_bytes) <= max_bytes:
        return image_bytes


    img = Image.open(io.BytesIO(image_bytes))


    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")


    quality = 85
    while quality > 10:
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=quality)
        compressed = buffer.getvalue()

        if len(compressed) <= max_bytes:
            return compressed

        quality -= 10


    width, height = img.size
    img = img.resize((width // 2, height // 2), Image.LANCZOS)
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()



def extract_text_from_image(image_bytes: str, media_type: str) -> str:
    print(f"Original image size: {len(image_bytes)} bytes")
    compressed_bytes = compress_image(image_bytes)
    print(f"Compressed image size: {len(compressed_bytes)} bytes")
    base64_image = base64.b64encode(compressed_bytes).decode("utf-8")
    response = claude.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": base64_image
                    }
                },
                {
                    "type": "text",
                    "text": "Extract all text from this image exactly as it appears. Preserve the structure and layout as much as possible."
                }
            ]
        }]
    )
    return response.content[0].text



