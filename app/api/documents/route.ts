import { NextResponse } from "next/server";
import { ensureDataDirs, readSettings, saveDocument } from "../../../lib/store";

export const runtime = "nodejs";

export async function GET() {
  await ensureDataDirs();
  const settings = await readSettings();
  return NextResponse.json({ documents: settings.documents });
}

export async function POST(request: Request) {
  try {
    await ensureDataDirs();
    const formData = await request.formData();
    const files = formData.getAll("documents");

    if (!files.length) {
      return NextResponse.json({ error: "No documents uploaded." }, { status: 400 });
    }

    const saved = [] as Awaited<ReturnType<typeof saveDocument>>[];

    for (const item of files) {
      if (!(item instanceof File)) {
        continue;
      }
      saved.push(await saveDocument(item));
    }

    return NextResponse.json({ documents: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
