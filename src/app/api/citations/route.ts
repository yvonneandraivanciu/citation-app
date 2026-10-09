import { NextRequest, NextResponse } from "next/server";
import { formatters, STYLE_LABELS, StyleKey, SourceData } from "@/lib/formatters";
import { verifyToken } from "@/lib/auth";
import { saveCitation, getCitationsByUser, deleteCitation } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { style, sourceData, save, lang } = body as {
    style: StyleKey;
    sourceData: SourceData;
    save: boolean;
    lang?: "en" | "fr";
  };

  if (!formatters[style]) {
    return NextResponse.json({ error: "Unknown citation style." }, { status: 400 });
  }

  const formatter = formatters[style];
  const formatted = formatter(sourceData, lang || "en");

  if (save) {
    const token = req.cookies.get("token")?.value;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        await saveCitation({
          userId: payload.userId,
          style,
          styleLabel: STYLE_LABELS[style],
          sourceType: sourceData.sourceType,
          inputData: sourceData as unknown as Record<string, string>,
          formatted,
        });
      }
    }
  }

  // Per guide: footnote citations must end with a period
  const withPeriod = formatted.endsWith(".") ? formatted : formatted + ".";
  return NextResponse.json({ formatted: withPeriod });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const citations = await getCitationsByUser(payload.userId);
  return NextResponse.json({ citations });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  const deleted = await deleteCitation(id, payload.userId);
  return NextResponse.json({ ok: deleted });
}
