import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function GET(request: Request) {
  clearSession();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
