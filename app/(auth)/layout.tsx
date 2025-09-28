// app/(auth)/layout.tsx
import { getServerSession } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}