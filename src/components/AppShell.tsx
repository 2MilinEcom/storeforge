import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">SF</span><span><strong>StoreForge</strong><small>Commerce OS</small></span></Link>
      <nav>
        <Link href="/">Dashboard</Link>
        <Link href="/new">New build</Link>
        <Link href="/references">Reference brain</Link>
        <Link href="/settings">Settings</Link>
      </nav>
      <div className="sidebar-foot"><span className="dot live" /> Local owner mode<br/><small>SaaS-ready architecture</small></div>
    </aside>
    <main className="main-area">{children}</main>
  </div>;
}
