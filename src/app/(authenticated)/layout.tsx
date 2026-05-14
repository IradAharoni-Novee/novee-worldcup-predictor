import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TopBar } from "@/components/shell/top-bar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return (
    <div className="grid grid-rows-[auto_1fr] min-h-screen">
      <TopBar userEmail={session.user.email} isAdmin={session.user.isAdmin} />
      <main className="mx-auto w-full max-w-6xl">{children}</main>
    </div>
  );
}
