import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/awards", label: "Awards" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/sync", label: "Sync" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/matches");
  return (
    <div className="flex flex-col">
      <div className="px-6 pt-4">
        <nav className="flex gap-1 border-b border-[color:var(--color-border-primary)]">
          {TABS.map((tab) => (
            <AdminTab key={tab.href} href={tab.href} label={tab.label} />
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

function AdminTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
        "border-transparent text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
      )}
    >
      {label}
    </Link>
  );
}
