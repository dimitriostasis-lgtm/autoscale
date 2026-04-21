import { LoginCard } from "../components/auth/LoginCard";

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div className="flex min-h-screen items-center px-4 py-8 lg:px-8">
      <LoginCard onSubmit={onLogin} />
    </div>
  );
}