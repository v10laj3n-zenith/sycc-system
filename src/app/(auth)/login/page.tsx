import { isServerSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Welcome | SYCC Youth Web App",
  description:
    "Sign in or join the SYCC Youth Growth & Discipleship web application on mobile or laptop.",
};

export default function LoginPage() {
  const isSupabaseReady = isServerSupabaseConfigured();
  return <LoginForm isSupabaseReady={isSupabaseReady} />;
}
