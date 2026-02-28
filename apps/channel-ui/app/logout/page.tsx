"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      router.replace("/login");
      router.refresh();
    };
    void run();
  }, [router]);

  return (
    <div className="panel">
      <p>Signing out...</p>
    </div>
  );
}
