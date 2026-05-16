import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/shell/top-bar";
import { KonamiListener } from "@/components/easter-eggs/konami-listener";
import { CommandPalette } from "@/components/easter-eggs/command-palette";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  // Force users without a password through /set-password before the app loads.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, name: true, image: true },
  });
  if (!me?.passwordHash) redirect("/set-password");

  return (
    <div className="grid grid-rows-[auto_1fr] grid-cols-[minmax(0,1fr)] min-h-screen">
      <TopBar
        userEmail={session.user.email}
        userName={me.name}
        userImage={me.image}
        isAdmin={session.user.isAdmin}
      />
      <main className="mx-auto w-full max-w-6xl min-w-0">{children}</main>
      <KonamiListener />
      <CommandPalette isAdmin={Boolean(session.user.isAdmin)} />
    </div>
  );
}
