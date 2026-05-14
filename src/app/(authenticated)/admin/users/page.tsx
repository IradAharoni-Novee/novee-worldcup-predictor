import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminToggleButton } from "@/components/admin/admin-toggle-button";

export default async function AdminUsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { predictions: true } },
    },
  });

  return (
    <PageContainer title="Admin · Users">
      <Card className="p-0 py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Predictions</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === session?.user?.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u._count.predictions}
                  </TableCell>
                  <TableCell className="body body-size-small text-[color:var(--color-text-secondary)]">
                    {u.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {u.isAdmin ? (
                      <Chip size="small" color="brand" label="Admin" />
                    ) : (
                      <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AdminToggleButton
                      userId={u.id}
                      isAdmin={u.isAdmin}
                      disabled={isSelf}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </PageContainer>
  );
}
