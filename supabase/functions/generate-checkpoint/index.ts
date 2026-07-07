import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseAdmin.ts';

const ANTHROPIC_TIMEOUT_MS = 4000;

function buildSystemPrompt(bookTitle: string, bookAuthor: string, chapterSummary: string, deviceType: string): string {
  const isMobile = deviceType === 'mobile' || deviceType === 'web';
  const questionFormat = isMobile
    ? `- Generate 2 multiple choice questions with 4 options (A-D) and 1 open-response question
- For open-response: set "options" to an empty array [] and "correct_index" to -1
- Open-response questions should invite the reader to share a thought or connection (e.g., "What would you have done if you were...?")`
    : `- All questions multiple choice with 4 options (A-D)`;

  return `You are a friendly reading companion for 3rd grade students (age 8-9).

You are generating comprehension questions about a chapter from "${bookTitle}" by ${bookAuthor}.

CHAPTER SUMMARY (use this as your ONLY source of truth — do NOT make up plot details):
${chapterSummary}

RULES:
- Questions MUST be answerable from the chapter summary above
- Do NOT reference events, characters, or details not in the summary
- Reading level: 3rd grade
- Tone: encouraging, curious. "What did you notice about...?", "Can you remember when...?"
- NEVER use: "wrong", "incorrect", "failed"
${questionFormat}
- Mix: 1 recall, 1 inference, 1 vocabulary or prediction
- Explanations: max 2 sentences, positive

Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "...",
      "question_type": "recall|inference|vocabulary|prediction|connection"
    }
  ]
}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function validateCheckpointResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.questions)) return false;
  for (const q of obj.questions) {
    if (typeof q !== 'object' || !q) return false;
    const question = q as Record<string, unknown>;
    if (typeof question.question !== 'string') return false;
    if (!Array.isArray(question.options)) return false;
    const isOpenResponse = question.options.length === 0 && question.correct_index === -1;
    if (!isOpenResponse && (question.options.length !== 4 || typeof question.correct_index !== 'number' || question.correct_index < 0 || question.correct_index > 3)) return false;
    if (typeof question.explanation !== 'string') return false;
  }
  return true;
}

function getChapterSummary(chapterSummaries: Record<string, string>, chapterNumber: number): string {
  const summary = chapterSummaries[String(chapterNumber)];
  if (summary) return summary;

  const keys = Object.keys(chapterSummaries).map(Number).sort((a, b) => a - b);
  let bestKey = keys[0];
  for (const k of keys) {
    if (k <= chapterNumber) bestKey = k;
  }
  return chapterSummaries[String(bestKey)] || 'No chapter summary available.';
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { kid_id, book_id, chapter_number, kid_name, device_type } = await req.json();

    if (!kid_id || !book_id || !chapter_number) {
      return new Response(
        JSON.stringify({ error: 'kid_id, book_id, and chapter_number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = getServiceClient();

    const { data: book } = await supabase
      .from('books')
      .select('title, author, chapter_summaries, checkpoint_chapters')
      .eq('id', book_id)
      .single();

    if (!book) {
      return new Response(
        JSON.stringify({ error: 'Book not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const chapterSummary = getChapterSummary(book.chapter_summaries || {}, chapter_number);

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (anthropicKey && chapterSummary !== 'No chapter summary available.') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: buildSystemPrompt(book.title, book.author, chapterSummary, device_type || 'tv'),
            messages: [{
              role: 'user',
              content: `Generate 3 multiple choice comprehension questions about Chapter ${chapter_number} for ${kid_name || 'the reader'}.`,
            }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const result = await response.json();
          const text = result.content?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (validateCheckpointResponse(parsed)) {
              return new Response(
                JSON.stringify({ questions: parsed.questions, source: 'ai' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          }
        }
      } catch (_err) {
        clearTimeout(timeout);
      }
    }

    // Fallback: generic reading comprehension questions from fallback_questions
    const { data: fallbacks } = await supabase
      .from('fallback_questions')
      .select('question, options, correct_index, explanation, standard_code');

    if (fallbacks && fallbacks.length > 0) {
      const selected = shuffleArray(fallbacks).slice(0, 3);
      return new Response(
        JSON.stringify({ questions: selected, source: 'fallback' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ questions: [], source: 'client_fallback' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
