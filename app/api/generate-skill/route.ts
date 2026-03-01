import { NextRequest, NextResponse } from 'next/server';

type VisionProvider = 'claude' | 'openai' | 'gemini';

async function generateWithGemini(prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateWithOpenAI(prompt: string, model: string): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: model || 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content || '';
}

async function generateWithClaude(prompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not configured');

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const textContent = response.content.find(block => block.type === 'text');
  return textContent?.type === 'text' ? textContent.text : '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, provider = 'gemini', model } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }

    console.log(`[GenerateSkill] Provider: ${provider}, prompt length: ${prompt.length}`);

    let responseText: string;
    if (provider === 'claude') {
      responseText = await generateWithClaude(prompt);
    } else if (provider === 'openai') {
      responseText = await generateWithOpenAI(prompt, model);
    } else {
      responseText = await generateWithGemini(prompt);
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                     responseText.match(/```\n([\s\S]*?)\n```/);
    let jsonText = jsonMatch ? jsonMatch[1] : responseText;

    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonText = objectMatch[0];
    }

    const skill = JSON.parse(jsonText);

    // Validate required fields
    if (!skill.name || !skill.visionPrompt || !Array.isArray(skill.entityTypes)) {
      throw new Error('Generated skill missing required fields (name, visionPrompt, entityTypes)');
    }

    console.log(`[GenerateSkill] Success — "${skill.name}" with ${skill.entityTypes.length} entity types`);

    return NextResponse.json(skill);
  } catch (error: any) {
    console.error('[GenerateSkill] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate skill' },
      { status: 500 }
    );
  }
}
