import { NextResponse } from "next/server";

import {
  CreateManualPositionInputSchema,
  PatchManualPositionInputSchema,
} from "@pivotaledge/schemas";
import { createManualPosition, loadManualBook, patchManualPosition } from "@pivotaledge/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const book = await loadManualBook();
  return NextResponse.json(book);
}

export async function POST(request: Request) {
  try {
    const body = CreateManualPositionInputSchema.parse(await request.json());
    const position = await createManualPosition(body);
    return NextResponse.json({ ok: true, position });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = PatchManualPositionInputSchema.parse(await request.json());
    const position = await patchManualPosition(body);
    return NextResponse.json({ ok: true, position });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
