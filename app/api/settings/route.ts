import { NextResponse } from "next/server";
import { ensureDataDirs, readSettings, writeSettings } from "../../../lib/store";

export const runtime = "nodejs";

export async function GET() {
  await ensureDataDirs();
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  try {
    await ensureDataDirs();
    const payload = (await request.json()) as {
      prompts?: { week4?: string; week8?: string; week12?: string };
    };

    const settings = await readSettings();

    const nextSettings = {
      ...settings,
      prompts: {
        week4: payload.prompts?.week4 ?? settings.prompts.week4,
        week8: payload.prompts?.week8 ?? settings.prompts.week8,
        week12: payload.prompts?.week12 ?? settings.prompts.week12,
      },
    };

    await writeSettings(nextSettings);
    return NextResponse.json(nextSettings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
