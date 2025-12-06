import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";

const DATA_DIR = path.join(process.cwd(), "data");
const DOCS_DIR = path.join(DATA_DIR, "docs");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

export type StoredDocument = {
  id: string;
  name: string;
  size: number;
  mime: string;
  textPath: string;
  uploadedAt: string;
};

export type Settings = {
  prompts: {
    week4: string;
    week8: string;
    week12: string;
  };
  documents: StoredDocument[];
};

const defaultSettings: Settings = {
  prompts: {
    week4: "Simulate mild improvement with reduced redness and slightly improved vein visibility after 4 weeks of conservative treatment.",
    week8: "Simulate moderate improvement in vein prominence and skin appearance after 8 weeks of treatment.",
    week12: "Simulate significant improvement with visibly reduced varicose veins and healthier skin tone after 12 weeks of treatment.",
  },
  documents: [],
};

export async function ensureDataDirs() {
  await fs.mkdir(DOCS_DIR, { recursive: true });
}

export async function readSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Settings;
    return {
      ...defaultSettings,
      ...parsed,
      prompts: { ...defaultSettings.prompts, ...parsed.prompts },
      documents: parsed.documents ?? [],
    };
  } catch (error) {
    return defaultSettings;
  }
}

export async function writeSettings(settings: Settings) {
  await ensureDataDirs();
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

export async function saveDocument(file: File) {
  await ensureDataDirs();
  const id = crypto.randomUUID();
  const name = file.name;
  const mime = file.type;
  const size = file.size;
  const buffer = Buffer.from(await file.arrayBuffer());

  let textContent = "";

  if (mime === "text/plain") {
    textContent = buffer.toString("utf8");
  } else if (mime === "application/pdf") {
    try {
      const parsed = await pdfParse(buffer);
      textContent = parsed.text || "";
    } catch (error) {
      textContent = "";
      console.error("Failed to parse PDF", error);
    }
  }

  const textPath = path.join(DOCS_DIR, `${id}.txt`);
  await fs.writeFile(textPath, textContent, "utf8");

  const meta: StoredDocument = {
    id,
    name,
    size,
    mime,
    textPath,
    uploadedAt: new Date().toISOString(),
  };

  const settings = await readSettings();
  const nextSettings: Settings = {
    ...settings,
    documents: [...settings.documents, meta],
  };

  await writeSettings(nextSettings);

  return meta;
}

export async function loadDocumentTexts(documentIds: string[]) {
  const settings = await readSettings();
  const selected = settings.documents.filter((doc) => documentIds.includes(doc.id));

  const contents: { id: string; name: string; text: string }[] = [];
  for (const doc of selected) {
    try {
      const text = await fs.readFile(doc.textPath, "utf8");
      contents.push({ id: doc.id, name: doc.name, text });
    } catch (error) {
      console.warn(`Failed to read document ${doc.id}`, error);
    }
  }

  return contents;
}

export async function loadAllDocumentTexts() {
  const settings = await readSettings();
  return loadDocumentTexts(settings.documents.map((doc) => doc.id));
}
