import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseAdmin.ts';

const ANTHROPIC_TIMEOUT_MS = 4000;

const QUIZ_SYSTEM_PROMPT = `You are a friendly quiz creator for 3rd grade students (age 8-9).

RULES:
- Reading level: 3rd grade (simple vocabulary, short sentences)
- Tone: encouraging, curious, celebratory. Use phrases like "Great thinking!", "Almost there!", "You're learning so much!"
- NEVER use: "wrong", "incorrect", "failed", "you should have known", "that's not right"
- Instead say: "Not quite!", "Let's try again!", "Close! Here's a hint..."
- Each question: 4 options (A, B, C, D), exactly one correct
- Explanation for correct answer: max 2 sentences, age-appropriate, positive
- Questions must align with the provided NYS standard code
- Difficulty: bronze (basic recall), silver (application), gold (analysis)
- All questions MUST be multiple choice — no open response, no fill-in-the-blank

Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "...",
      "standard_code": "NY-3.OA.1"
    }
  ]
}`;

function buildQuizUserPrompt(
  lessonName: string,
  moduleName: string,
  subject: string,
  standardCodes: string[],
  difficulty: string,
  questionCount: number,
): string {
  return `Generate ${questionCount} ${difficulty}-level multiple choice questions about "${lessonName}" for the "${moduleName}" module.
Subject: ${subject}
NYS Standard: ${standardCodes.join(', ')}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function validateQuizResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.questions)) return false;
  for (const q of obj.questions) {
    if (typeof q !== 'object' || !q) return false;
    const question = q as Record<string, unknown>;
    if (typeof question.question !== 'string') return false;
    if (!Array.isArray(question.options) || question.options.length !== 4) return false;
    if (typeof question.correct_index !== 'number' || question.correct_index < 0 || question.correct_index > 3) return false;
    if (typeof question.explanation !== 'string') return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { kid_id, lesson_id, difficulty = 'bronze', question_count = 3, mutation_id } = await req.json();

    if (!kid_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: 'kid_id and lesson_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = getServiceClient();

    // Idempotency check
    if (mutation_id) {
      const { data: existing } = await supabase
        .from('processed_mutations')
        .select('result')
        .eq('mutation_id', mutation_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ ...existing.result, source: 'cached' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Fetch lesson + module context
    const { data: lesson } = await supabase
      .from('lessons')
      .select('lesson_name, module_id')
      .eq('id', lesson_id)
      .single();

    if (!lesson) {
      return new Response(
        JSON.stringify({ error: 'Lesson not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: module } = await supabase
      .from('modules')
      .select('module_name, subject, standard_codes')
      .eq('id', lesson.module_id)
      .single();

    if (!module) {
      return new Response(
        JSON.stringify({ error: 'Module not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Try Anthropic with 4s timeout
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (anthropicKey) {
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
            system: QUIZ_SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: buildQuizUserPrompt(
                lesson.lesson_name,
                module.module_name,
                module.subject,
                module.standard_codes || [],
                difficulty,
                question_count,
              ),
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
            if (validateQuizResponse(parsed)) {
              return new Response(
                JSON.stringify({ questions: parsed.questions, source: 'ai' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          }
        }
      } catch (_err) {
        clearTimeout(timeout);
        // Fall through to database fallback
      }
    }

    // Tier 1 fallback: database fallback_questions
    const { data: fallbacks } = await supabase
      .from('fallback_questions')
      .select('question, options, correct_index, explanation, standard_code')
      .eq('module_id', lesson.module_id);

    if (fallbacks && fallbacks.length > 0) {
      const selected = shuffleArray(fallbacks).slice(0, question_count);
      return new Response(
        JSON.stringify({ questions: selected, source: 'fallback' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Tier 2: signal client to use bundled JSON
    return new Response(
      JSON.stringify({ questions: [], source: 'client_fallback' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
