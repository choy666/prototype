// app/(auth)/layout.tsx
import { auth } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (session?.user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}