import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const response = () =>
  NextResponse.json({ error: "Waste tracking is disabled" }, { status: 403 });

export async function GET() {
  return response();
}

export async function POST() {
  return response();
}

export async function PUT() {
  return response();
}

export async function DELETE() {
  return response();
}

export async function PATCH() {
  return response();
}
