import { NextRequest, NextResponse } from "next/server";
import { listThemes } from "@/lib/builder/shopify";

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId") || "";
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  try { return NextResponse.json(await listThemes(storeId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
