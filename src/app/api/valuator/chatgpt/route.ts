import { NextResponse } from "next/server";

type OpenAiValuation = {
  min: number;
  max: number;
  media: number;
  commento: string;
  zonaOmi?: string | null;
  omiMin?: string | null;
  omiMax?: string | null;
};

function extractJson(text: string) {
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // continua
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("JSON non trovato nella risposta OpenAI");
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error("JSON non valido nella risposta OpenAI");
  }
}

function isValidValuation(data: any): data is OpenAiValuation {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.min === "number" &&
    typeof data.max === "number" &&
    typeof data.media === "number" &&
    typeof data.commento === "string"
  );
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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

    const zonaInput =
      body?.contesto_localizzazione?.zona ||
      body?.contesto_localizzazione?.microzona ||
      body?.contesto_localizzazione?.indirizzo ||
      "";

    const userPrompt = `
Sei un valutatore immobiliare italiano esperto.

Obiettivo:
stimare il più realistico VALORE DI MERCATO di compravendita dell'immobile,
cioè il prezzo a cui può essere realmente venduto in condizioni normali di mercato.

PRIORITÀ ASSOLUTA:
1. Comune
2. Zona / quartiere
3. Microzona, via, indirizzo, civico se presenti

Regole obbligatorie:
- La localizzazione pesa moltissimo nella stima.
- Se sono presenti comune e zona, usali come fattore principale della valutazione.
- Se è presente anche indirizzo o civico, usali per affinare il giudizio, senza inventare dati non forniti.
- Dai poi peso a: metratura, tipologia, stato immobile, piano, ascensore, sfoghi esterni, box/posto auto, stato stabile, esposizione, luminosità, pertinenze e criticità.
- Non essere eccessivamente prudente solo perché mancano alcuni dati.
- Non fare una stima artificiosamente bassa.
- Se l'immobile ha elementi di pregio, valorizzali.
- Se ha problemi, penalizzalo in modo realistico ma non distruttivo, salvo gravi criticità.
- Ragiona come un agente immobiliare esperto della zona.

Dati ricevuti:
${JSON.stringify(body, null, 2)}

Devi restituire SOLO JSON valido, senza testo extra, senza markdown, senza backticks.

Formato obbligatorio:
{
  "min": number,
  "max": number,
  "media": number,
  "commento": string,
  "zonaOmi": string | null,
  "omiMin": string | null,
  "omiMax": string | null
}

Vincoli numerici:
- min = valore minimo realistico di vendita
- max = valore massimo realistico di vendita
- media = valore centrale realistico
- media deve stare tra min e max
- max deve essere strettamente maggiore di min
- usa numeri interi senza simboli

Vincoli commento:
- massimo 8 righe
- commento sintetico ma professionale
- indica in modo concreto quali fattori incidono sul valore
- cita la localizzazione se presente
- se mancano dati rilevanti, dillo brevemente

Vincoli OMI:
- zonaOmi: se puoi ricavarla dai dati ricevuti, valorizzala; altrimenti usa null
- omiMin e omiMax: se NON hai una base affidabile, usa null e non inventare
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        messages: [
          {
            role: "system",
            content:
              "Sei un esperto valutatore immobiliare italiano. Devi rispondere solo con JSON valido. Nessun testo fuori dal JSON.",
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

    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Risposta vuota da OpenAI" },
        { status: 500 }
      );
    }

    const parsed = extractJson(content);

    if (!isValidValuation(parsed)) {
      return NextResponse.json(
        { error: "Formato JSON OpenAI non valido", raw: content },
        { status: 500 }
      );
    }

    if (parsed.max <= parsed.min) {
      return NextResponse.json(
        { error: "Valori non coerenti restituiti dal modello" },
        { status: 500 }
      );
    }

    if (parsed.media < parsed.min || parsed.media > parsed.max) {
      return NextResponse.json(
        { error: "Media fuori range restituita dal modello" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      min: Math.round(parsed.min),
      max: Math.round(parsed.max),
      media: Math.round(parsed.media),
      commento: parsed.commento.trim(),
      zonaOmi: safeString(parsed.zonaOmi) || safeString(zonaInput) || null,
      omiMin: safeString(parsed.omiMin) || null,
      omiMax: safeString(parsed.omiMax) || null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Errore server",
      },
      { status: 500 }
    );
  }
}