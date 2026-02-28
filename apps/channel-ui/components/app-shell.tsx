"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EventsPanel } from "./events-panel";

const Item = ({ href, label, pathname }: { href: string; label: string; pathname: string }) => (
  <Link
    href={href}
    style={{
      display: "block",
      padding: "8px 10px",
      borderRadius: 8,
      marginBottom: 4,
      background: pathname.startsWith(href) ? "var(--brand-soft)" : "transparent",
      fontWeight: pathname.startsWith(href) ? 700 : 400,
    }}
  >
    {label}
  </Link>
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <h2 style={{ marginTop: 0 }}>nodeCore UI</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Channel app (UI-1)
        </p>

        <h4>Product Management</h4>
        <Item href="/product-management/products" label="Products" pathname={pathname} />
        <Item href="/product-management/components?type=COVERAGE" label="Coverage Components" pathname={pathname} />
        <Item href="/product-management/components?type=EXPOSURE" label="Exposure Components" pathname={pathname} />
        <Item href="/product-management/components?type=RULE" label="Rule Components" pathname={pathname} />
        <Item href="/product-management/pricing-programs" label="Pricing Programs" pathname={pathname} />

        <h4 style={{ marginTop: 20 }}>Policy</h4>
        <Item href="/policy/policies" label="Policies" pathname={pathname} />
        <Item href="/policy/create" label="Create New Business" pathname={pathname} />

        <h4 style={{ marginTop: 20 }}>Billing</h4>
        <Item href="/billing/accounts" label="Accounts" pathname={pathname} />
        <Item href="/billing/invoices" label="Invoices" pathname={pathname} />
        <Item href="/billing/payments" label="Payments" pathname={pathname} />

        <div style={{ marginTop: 20 }}>
          <Link href="/logout" className="muted">
            Logout
          </Link>
        </div>
      </aside>
      <main className="main">
        {children}
        <EventsPanel />
      </main>
    </div>
  );
}
