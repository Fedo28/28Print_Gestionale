import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { getSession } from "@/lib/auth";

export default function LoginPage() {
  if (getSession()) {
    redirect("/");
  }

  return (
    <div className="center-stage">
      <section className="card card-pad auth-card">
        <div className="stack">
          <div>
            <h2>Accesso gestionale</h2>
            <p className="card-muted">Login locale per il team del negozio.</p>
          </div>
          <form action={loginAction} className="stack">
            <div className="field full">
              <label htmlFor="email">Email</label>
              <input defaultValue="admin@fede.local" id="email" name="email" type="email" required />
            </div>
            <div className="field full">
              <label htmlFor="password">Password</label>
              <input defaultValue="admin123" id="password" name="password" type="password" required />
            </div>
            <div className="button-row">
              <button className="primary" type="submit">
                Accedi
              </button>
            </div>
          </form>
          <p className="hint">
            Credenziali iniziali seed: <code>admin@fede.local</code> / <code>admin123</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
