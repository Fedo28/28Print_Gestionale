import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getLoginHealth, getSession } from "@/lib/auth";
import brandLogo from "@/logo.png";

export default async function LoginPage() {
  if (getSession()) {
    redirect("/");
  }

  const health = await getLoginHealth();
  const isLocalDev = process.env.NODE_ENV !== "production";

  return (
    <div className="center-stage login-page-shell">
      <section className="card card-pad auth-card login-card">
        <div className="login-brand-panel">
          <Image alt="28 Print" className="login-brand-logo" priority sizes="96px" src={brandLogo} />
          <div className="login-brand-mark">
            <span>28 Print</span>
            <strong>Gestionale</strong>
          </div>
        </div>

        <div className="stack login-access-panel">
          <div className="login-access-head">
            <h2>Accesso</h2>
          </div>
          <LoginForm
            defaultNickname={isLocalDev ? "fedo" : ""}
            defaultPassword={isLocalDev ? "admin123" : ""}
            healthMessage={health.ready ? undefined : health.message}
          />
        </div>
      </section>
    </div>
  );
}
