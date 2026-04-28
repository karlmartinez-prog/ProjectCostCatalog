const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function buildPrompt(form, categories) {
    const categoryList = categories.length
        ? categories.map(c => `${c.name} (${c.type})`).join(', ')
        : 'Civil Works, Electrical, Labor, Materials, Equipment'

    return `You are a construction and infrastructure project cost estimator for the Philippines, specializing in telecom and network facilities.

A supervisor wants to estimate the cost of a project with these details:
- Project type: ${form.projectType}
- Location: ${form.location || 'Philippines (general)'}
- Size / scope: ${form.size || 'Not specified'}
- Duration: ${form.duration || 'Not specified'}
- Currency: ${form.currency}
- Additional notes: ${form.notes || 'None'}

Available cost categories in their system: ${categoryList}

Return ONLY a valid JSON object with this exact structure, no explanation, no markdown, no backticks:
{
  "summary": "2-3 sentence plain English summary of the estimate",
  "low": <number>,
  "mid": <number>,
  "high": <number>,
  "currency": "${form.currency}",
  "breakdown": [
    {
      "category": "string",
      "type": "CAPEX or OPEX",
      "low": <number>,
      "mid": <number>,
      "high": <number>,
      "note": "string"
    }
  ],
  "assumptions": ["string", "string", "string"]
}`
}

export async function estimateProjectCost(form, categories) {
    if (!GROQ_API_KEY) throw new Error('Groq API key is missing. Add VITE_GROQ_API_KEY to your .env.local file.')

    const prompt = buildPrompt(form, categories)

    const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            temperature: 0.4,
            messages: [
                {
                    role: 'system',
                    content: 'You are a cost estimator. Always respond with valid JSON only. No markdown, no explanation.',
                },
                {
                    role: 'user',
                    content: prompt,
                }
            ],
        }),
    })

    if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'Groq request failed.')
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) throw new Error('Empty response from Groq.')

    try {
        return JSON.parse(text)
    } catch {
        const clean = text.replace(/```json|```/g, '').trim()
        return JSON.parse(clean)
    }
}