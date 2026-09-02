import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
