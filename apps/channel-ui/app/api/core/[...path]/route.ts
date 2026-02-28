import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, CORE_API_BASE_URL } from "@/lib/auth/constants";

const parseRequestBody = async (request: Request): Promise<string | undefined> => {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }
  const text = await request.text();
  return text.length > 0 ? text : undefined;
};

const proxy = async (request: Request, params: { path: string[] }): Promise<Response> => {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  const body = await parseRequestBody(request);
  const query = new URL(request.url).search;
  const targetPath = params.path.join("/");
  const correlationId = request.headers.get("x-correlation-id") ?? randomUUID();

  const upstream = await fetch(`${CORE_API_BASE_URL}/${targetPath}${query}`, {
    method: request.method,
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
      "x-correlation-id": correlationId,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body } : {}),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "x-correlation-id": correlationId,
    },
  });
};

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}
export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}
export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}
export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await context.params);
}
