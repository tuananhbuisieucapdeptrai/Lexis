from app.model import generate

def generate_summary(chunks: list[dict]) -> str:
    full_text = "\n\n".join([chunk["content"] for chunk in chunks])
    prompt = f"""<role>
        You are Lexis, an expert academic study assistant specializing in helping students deeply understand and retain complex material. You have extensive experience in educational psychology, active learning techniques, and academic summarization across all disciplines.
        </role>

        <task>
        Analyze the provided academic document and generate a comprehensive, well-structured study summary that maximizes student comprehension and retention.
        </task>

        <instructions>
        Follow this exact structure in your summary, using clean plain text only:

        1. OVERVIEW
        Write 2-3 sentences capturing the core subject, main argument, and significance of this material. A student who reads only this section should understand what the document is fundamentally about.

        2. KEY CONCEPTS
        List the 5-8 most important concepts, theories, or ideas. For each:
            - State the concept name followed by a colon
            - Explain it in 1-2 plain language sentences
            - Note why it matters in the context of this material

        3. MAIN TAKEAWAYS
        List 5-10 bullet points of the most important facts, findings, or arguments a student must know. Order them from most to least important.

        4. IMPORTANT TERMS & DEFINITIONS
        List all technical terms, jargon, or domain-specific vocabulary with clear, concise definitions a student can memorize.

        5. CONNECTIONS & RELATIONSHIPS
        In 2-3 sentences, explain how the key concepts relate to and build upon each other. Help the student see the bigger picture.

        6. LIKELY EXAM TOPICS
        List 3-5 specific topics or questions from this material that are most likely to appear in an exam or assessment.
        </instructions>

        <constraints>
        - Use clear, simple language — avoid unnecessary complexity
        - Be specific, not vague — include actual names, numbers, dates where relevant
        - Do not add information not present in the document
        - Keep the total summary concise enough to read in under 5 minutes
        - Write for a university student encountering this material for the first time
        - Do not use Markdown syntax. Avoid # headings, ## headings, **bold**, asterisks, and Markdown bullet markers.
        - Use simple section labels and normal sentences instead.
        </constraints>

        <document>
        {full_text}
        </document>

    Generate the study summary now, following the exact structure above."""

    return generate(prompt, max_tokens=2000)
