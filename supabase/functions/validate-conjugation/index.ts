const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

async function askGemini(prompt: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    if (body.mode === "generate") {
      const words = Array.isArray(body.words) ? body.words.slice(0, 10) : [];
      const prompt = `
Create a beginner Ukrainian grammar Mad Libs exercise using exactly ${words.length} vocabulary items.

Vocabulary JSON:
${JSON.stringify(words)}

Return JSON only in this format:
{
  "title": "short English title",
  "paragraph": "Ukrainian paragraph with placeholders {0}, {1}, etc.",
  "translation": "English translation of the complete paragraph",
  "blanks": [
    {
      "index": 0,
      "infinitive": "dictionary form",
      "answer": "correct form for the paragraph",
      "alternatives": [],
      "grammar": "brief English grammar explanation"
    }
  ]
}

Rules:
- Use 5 to 10 supplied vocabulary items when possible.
- Every supplied vocabulary item must correspond to one numbered blank.
- Use the supplied word as the grammatical target, not as unrelated background vocabulary.
- For verbs, the blank must contain an inflected/conjugated form, never the raw infinitive.
- For nouns or adjectives, use an appropriate declined or inflected form and explain the case.
- The paragraph must be natural Ukrainian.
- Include a natural English translation of the complete paragraph.
- Every placeholder must have exactly one matching blanks entry.
- Put the infinitive only in the metadata, not in place of the blank.
- The answer field must be the inflected form used at that placeholder.
- Do not include explanations inside the Ukrainian paragraph.
`;
      const exercise = await askGemini(prompt, apiKey);
      return new Response(JSON.stringify(exercise), { headers: jsonHeaders });
    }

    const prompt = `
Validate this Ukrainian grammar answer in context.

Paragraph:
${body.sentence}

Infinitive:
${body.infinitive}

Learner answer:
${body.typedAnswer}

Required grammar:
${body.grammar || "Infer the required grammar from context."}

Return JSON only:
{
  "correct": true,
  "correctedAnswer": "",
  "explanation": "brief English explanation",
  "grammarNote": "brief grammar note",
  "confidence": 0.0
}
`;
    const result = await askGemini(prompt, apiKey);
    return new Response(JSON.stringify(result), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});