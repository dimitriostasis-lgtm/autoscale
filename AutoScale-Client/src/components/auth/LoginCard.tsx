import { type FormEvent, useState } from "react";

import { cx } from "../../lib/cx";
import { theme } from "../../styles/theme";

interface LoginCardProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginCard({ onSubmit }: LoginCardProps) {
  const [email, setEmail] = useState("admin@autoscale.internal");
  const [password, setPassword] = useState("Admin!123");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await onSubmit(email, password);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(135deg,rgba(199,255,39,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 shadow-[0_36px_90px_rgba(0,0,0,0.35)] lg:p-12">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="space-y-6">
            <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
              Private Operations Layer
            </span>
            <div className="space-y-4">
              <h1 className="font-display max-w-3xl text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
                Structured internal generation around a real Higgsfield worker bridge.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/66 sm:text-lg">
                AutoScale gives your team gated access to influencer-specific workspaces, controlled permissions, Airtable-style job batching, and model-isolated galleries without exposing the raw automation layer.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Role isolation", "Platform admin, agency admin, agency manager, and user access stays explicit and enforceable."],
              ["Board control", "Each board keeps its own rows, settings, outputs, and history siloed."],
              ["Worker routing", "Every row maps back to the correct worker output or failure state."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-3xl border border-white/8 bg-black/18 p-4 backdrop-blur-xl">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cx(theme.cardStrong, "p-6 sm:p-8") + " glass-panel"}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-lime-300/90">Employee Sign In</p>
            <h2 className="font-display mt-3 text-3xl text-white">Access AutoScale</h2>
          </div>
          <div className="rounded-full border border-lime-300/30 bg-lime-300/12 px-4 py-2 text-xs font-semibold text-lime-200">
            Private
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/80">Email</span>
            <input className={theme.input} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/80">Password</span>
            <input
              className={theme.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
          ) : null}

          <button className={theme.buttonPrimary + " w-full py-3 text-base"} disabled={isLoading} type="submit">
            {isLoading ? "Signing in..." : "Enter platform"}
          </button>
        </form>

        <div className="mt-8 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <p className="text-sm font-semibold text-white">Fresh-store seed accounts</p>
          <p className="mt-2 text-sm text-white/52">If your local data store predates this role update, create a manager account from Admin Access instead.</p>
          <div className="mt-3 grid gap-3 text-sm text-white/65">
            <div>
              <p className="font-medium text-white/85">Platform Admin</p>
              <p>admin@autoscale.internal / Admin!123</p>
            </div>
            <div>
              <p className="font-medium text-white/85">Agency Admin</p>
              <p>agencyadmin@autoscale.internal / AgencyAdmin!123</p>
            </div>
            <div>
              <p className="font-medium text-white/85">Agency Manager</p>
              <p>manager@autoscale.internal / Manager!123</p>
            </div>
            <div>
              <p className="font-medium text-white/85">User</p>
              <p>user@autoscale.internal / User!123</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}