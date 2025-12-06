import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadAllDocumentTexts, readSettings } from "../../../lib/store";

const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const settings = await readSettings();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is missing on the server." }, { status: 500 });
    }

    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: "An image file is required for analysis." }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.includes(image.type)) {
      return NextResponse.json({ error: "Only PNG and JPG images are supported." }, { status: 400 });
    }

    const base64Image = Buffer.from(await image.arrayBuffer()).toString("base64");
    const docTexts = await loadAllDocumentTexts();

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "Jsi zkušený cévní lékař zaměřený na žilní onemocnění. Vždy odpovídej česky, strukturovaně a stručně. Přidej krátké sekce: 'Nálezy', 'Možná rizika', 'Co probrat s lékařem'. Ujasni, že jde o edukativní výstup, nikoliv diagnózu.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Posuď viditelné žilní problémy na fotografii. Shrň stručně a jasně." },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.type};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text:
                docTexts.length > 0
                  ? `Pro kontext použij následující medicínské dokumenty: ${docTexts
                      .map((doc) => `\nSoubor: ${doc.name}\nObsah: ${doc.text.slice(0, 3000)}`)
                      .join("\n\n")}`
                  : "Bez dodaných dokumentů RAG.",
            },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI nevrátil odpověď.");
    }

    return NextResponse.json({ assessment: content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
