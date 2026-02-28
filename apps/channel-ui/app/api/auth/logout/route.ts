import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";

export async function POST(): Promise<Response> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  return NextResponse.json({ ok: true });
}
