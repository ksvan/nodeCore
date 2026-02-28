import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "./constants";

export const getAccessToken = async (): Promise<string | null> => {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
};
