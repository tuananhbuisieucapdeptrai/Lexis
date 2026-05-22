import json
import re
from app.model import generate


def _extract_json_array(response: str):
    cleaned = response.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("Model did not return a JSON array")
        parsed = json.loads(cleaned[start:end + 1])

    if isinstance(parsed, dict):
        parsed = parsed.get("concepts") or parsed.get("data") or parsed.get("items")

    if not isinstance(parsed, list):
        raise ValueError("Concept response must be a JSON array")

    return parsed


def _normalize_concept(item):
    if not isinstance(item, dict):
        return None

    concept = str(item.get("concept") or item.get("name") or item.get("term") or "").strip()
    if not concept:
        return None

    return {
        "concept": concept,
        "definition": str(item.get("definition") or "").strip(),
        "explanation": str(item.get("explanation") or item.get("description") or "").strip(),
        "example": str(item.get("example") or "").strip(),
        "related_concepts": item.get("related_concepts") if isinstance(item.get("related_concepts"), list) else [],
        "importance": str(item.get("importance") or "").strip(),
    }

def generate_concepts(chunks: list[dict]) -> list[dict]:
    full_text = "\n\n".join([chunk["content"] for chunk in chunks])

    prompt = f"""<role>
You are Lexis, an expert academic knowledge curator specializing in identifying, extracting, and explaining core concepts from complex academic material. You have deep expertise in knowledge representation, concept mapping, and breaking down dense academic content into clear, memorable knowledge units that students can build upon progressively.
</role>

<task>
Analyze the provided academic document and extract all key concepts, terms, theories, and principles that a student must understand to master this material. For each concept, provide a rich, structured explanation that goes beyond a simple definition — help the student truly understand it.
</task>

<instructions>
Extract and explain concepts following these strict quality rules:

CONCEPT TYPES TO INCLUDE:
1. Core terms — fundamental vocabulary and domain-specific terminology
2. Theories & frameworks — named models, theories, or conceptual frameworks
3. Principles & laws — rules, laws, or governing principles in the subject
4. Processes & mechanisms — how something works or happens step by step
5. People & contributions — key figures and their specific contributions if mentioned

QUALITY RULES FOR EACH CONCEPT:
- concept: the exact term or name as it appears in the document
- definition: clear, precise definition in 1-2 sentences using plain language
- explanation: deeper explanation in 2-3 sentences — go beyond the definition,
  explain the significance, context, or how it works in practice
- example: a concrete, specific example that illustrates the concept
  → use examples from the document if available
  → if no example exists in the document, create a simple relatable analogy
- related_concepts: list of other concept names from the document that
  directly connect to this concept — helps student see the bigger picture
- importance: one sentence explaining WHY this concept matters in the
  context of this subject — why should a student prioritize learning this?

OUTPUT FORMAT:
Return ONLY a valid JSON array. No explanation, no markdown, no preamble. Exactly this structure:
[
  {{
    "concept": "concept name here",
    "definition": "clear 1-2 sentence definition here",
    "explanation": "deeper 2-3 sentence explanation here",
    "example": "concrete example or analogy here",
    "related_concepts": ["related concept 1", "related concept 2"],
    "importance": "one sentence on why this concept matters"
  }}
]
</instructions>

<constraints>
- Extract between 8-12 concepts depending on document complexity
- Prioritize concepts by importance — most fundamental concepts first
- Do not extract trivial or obvious terms that require no explanation
- Do not add information or examples not grounded in the document content
- Every concept must be distinct — no duplicates or near-duplicates
- related_concepts must only reference other concepts extracted from
  the same document — do not invent connections to outside knowledge
- Return ONLY the JSON array — any extra text will break the parser
</constraints>

<document>
{full_text}
</document>

Generate the key concepts JSON array now:"""

    response = generate(prompt, max_tokens=5000)
    concepts = [_normalize_concept(item) for item in _extract_json_array(response)]
    concepts = [concept for concept in concepts if concept]

    if not concepts:
        raise ValueError("No valid concepts were generated")

    return concepts

