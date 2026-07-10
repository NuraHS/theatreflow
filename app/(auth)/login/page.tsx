import { LoginForm } from "@/components/layout/login-form";

export default function LoginPage() {
  return (
    <main className="clinical-grid flex min-h-screen items-center justify-center bg-cyan-50/50 px-4 py-10 dark:bg-background">
      <LoginForm />
    </main>
  );
}
