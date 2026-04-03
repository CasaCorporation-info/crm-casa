import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY non configurata" },
        { status: 500 }
      );
    }

    const userPrompt = `
Analizza questi dati immobiliari:

${JSON.stringify(body, null, 2)}

Fornisci:
1) Valore minimo realistico
2) Valore massimo realistico
3) Valore medio stimato
4) Commento professionale sintetico (max 10 righe)

Rispondi SOLO in JSON così:
{
  "min": number,
  "max": number,
  "media": number,
  "commento": string
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Sei un esperto valutatore immobiliare italiano. Le tue stime devono essere realistiche, prudenti e basate su logica di mercato.",
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Errore OpenAI" },
        { status: response.status }
      );
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Risposta vuota da OpenAI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: content });
  } catch (err) {
    return NextResponse.json(
      { error: "Errore server" },
      { status: 500 }
    );
  }
}