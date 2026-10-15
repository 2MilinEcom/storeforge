import { NextResponse } from "next/server";
import { repo } from "@/lib/repository";
export async function GET() { return NextResponse.json(await repo.listThemeProfiles()); }
