import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { requireAgency } from '@/lib/auth';

const MODEL = 'anthropic/claude-sonnet-5';

export async function POST(request: Request) {
  // agency only: this spends money
  await requireAgency();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: 'AI_GATEWAY_API_KEY is not set.' },
      { status: 501 }
    );
  }

  const { prompt } = await request.json().catch(() => ({ prompt: '' }));
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'No prompt supplied.' }, { status: 400 });
  }

  try {
    const { text } = await generateText({ model: MODEL, prompt });
    return NextResponse.json({ text });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);

    // The most likely failure right now is billing, so say so plainly instead
    // of surfacing a raw gateway error.
    const billing =
      /credit card|customer_verification|payment|quota|billing/i.test(raw);

    return NextResponse.json(
      {
        error: billing
          ? 'AI Gateway needs a credit card on the Vercel team before it will serve requests. Add one, then try again.'
          : raw,
      },
      { status: billing ? 402 : 500 }
    );
  }
}
