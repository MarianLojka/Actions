import { NextResponse } from "next/server";
import imageSize from "image-size";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const prompt = formData.get("prompt");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is missing on the server." }, { status: 500 });
    }

    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: "An image file is required." }, { status: 400 });
    }

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "A non-empty prompt is required." }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.includes(image.type)) {
      return NextResponse.json({ error: "Only PNG and JPG images are supported." }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { width, height, type } = imageSize(buffer);

    if (!width || !height) {
      return NextResponse.json({ error: "Could not read the uploaded image size." }, { status: 400 });
    }

    // Keep the edited image the same size as the original where supported by API
    const size = "auto" as any;

    const file = await toFile(buffer, image.name || `upload.${type ?? "png"}`, {
      type: image.type || "image/png",
    });

    const openai = new OpenAI({ apiKey });

    const openaiResponse = await openai.images.edit({
      model: "gpt-image-1",
      prompt,
      image: file,
      size,
    });

    const edited = openaiResponse.data?.[0];

    if (edited?.b64_json) {
      return NextResponse.json({ image: `data:image/png;base64,${edited.b64_json}` });
    }

    if (edited?.url) {
      const imgRes = await fetch(edited.url);
      if (!imgRes.ok) {
        throw new Error(`Failed to fetch edited image from URL (status ${imgRes.status}).`);
      }
      const arrayBuffer2 = await imgRes.arrayBuffer();
      const base642 = Buffer.from(arrayBuffer2).toString("base64");
      return NextResponse.json({ image: `data:image/png;base64,${base642}` });
    }

    throw new Error("OpenAI did not return an edited image.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
