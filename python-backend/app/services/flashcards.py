import json
from app.model import generate

def generate_flashcards(chunks: list[dict]) -> list[dict]:
    full_text = "\n\n".join([chunk["content"] for chunk in chunks])

    prompt = f"""<role>
You are Lexis, an expert academic study assistant specializing in active recall learning and spaced repetition methodology. You have deep expertise in cognitive science, memory retention, and creating high-quality educational flashcards that maximize long-term knowledge retention.
</role>

<task>
Analyze the provided academic document and generate a comprehensive set of high-quality flashcards that cover all essential knowledge a student must master from this material.
</task>

<instructions>
Generate flashcards following these strict quality rules:

CARD TYPES TO INCLUDE:
1. Definition cards — term on front, clear definition on back
2. Concept cards — "What is...?" or "Explain..." on front, concise explanation on back
3. Application cards — "How is X used...?" on front, practical explanation on back
4. Relationship cards — "What is the difference between X and Y?" on front, comparison on back
5. Fact cards — specific facts, dates, numbers, formulas on front, answer on back

QUALITY RULES FOR EACH CARD:
- Front: one clear, specific question or term — never vague or too broad
- Back: concise, direct answer in 1-3 sentences maximum — never a wall of text
- Each card tests exactly ONE piece of knowledge — never combine multiple concepts
- Back side should be memorable and scannable, not an essay
- Use plain language a student can recall under exam pressure

OUTPUT FORMAT:
Return ONLY a valid JSON array. No explanation, no markdown, no preamble. Exactly this structure:
[
  {{
    "front": "question or term here",
    "back": "answer or definition here",
    "type": "definition | concept | application | relationship | fact"
  }}
]
</instructions>

<constraints>
- Generate between 15-25 cards depending on document length and complexity
- Do not create duplicate or near-duplicate cards
- Do not add information not present in the document
- Do not make cards too easy (single obvious word answers) or too hard (requiring multiple steps)
- Every important term, concept, and fact in the document must be covered by at least one card
- Return ONLY the JSON array — any extra text will break the parser
</constraints>

<document>
{full_text}
</document>

Generate the flashcard JSON array now:"""

    response = generate(prompt, max_tokens=3000)

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        # sometimes Claude adds extra text despite instructions
        # extract just the JSON array portion
        start = response.index("[")
        end = response.rindex("]") + 1
        return json.loads(response[start:end])