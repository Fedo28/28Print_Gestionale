import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getLoginHealth, getSession } from "@/lib/auth";

export default async function LoginPage() {
  if (getSession()) {
    redirect("/");
  }

  const health = await getLoginHealth();
  const isLocalDev = process.env.NODE_ENV !== "production";

  return (
    <div className="center-stage">
      <section className="card card-pad auth-card">
        <div className="stack">
          <div>
            <h2>Accesso gestionale</h2>
            <p className="card-muted">Accesso staff per beta online e uso locale del gestionale.</p>
          </div>
          <LoginForm
            defaultNickname={isLocalDev ? "fedo" : ""}
            defaultPassword={isLocalDev ? "admin123" : ""}
            healthMessage={health.ready ? undefined : health.message}
          />
          {isLocalDev ? (
            <p className="hint">
              Credenziali iniziali seed locale: <code>Fedo</code> / <code>admin123</code>.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
