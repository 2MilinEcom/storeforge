import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";

export async function GET() {
  return NextResponse.json(integrationStatus());
}
