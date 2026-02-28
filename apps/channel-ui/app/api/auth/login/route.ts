import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ACCESS_TOKEN_COOKIE, CORE_API_BASE_URL } from "@/lib/auth/constants";
import type { AuthLoginResponse } from "@/lib/api/types";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const body = LoginSchema.parse(await request.json());
  const upstream = await fetch(`${CORE_API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await upstream.json().catch(() => ({ code: "LOGIN_FAILED", message: "Login failed" }));
  if (!upstream.ok) {
    return NextResponse.json(payload, { status: upstream.status });
  }

  const login = payload as AuthLoginResponse;
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, login.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: login.expiresIn,
  });

  return NextResponse.json({ user: login.user });
}
