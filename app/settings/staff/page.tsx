import Link from "next/link";
import { StaffProfileForm } from "@/components/staff-profile-form";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { userRoleLabels } from "@/lib/constants";
import {
  buildStaffInvitationPreview,
  getStaffInviteConfig,
  getStaffUsersAdmin
} from "@/lib/staff-users";

export const dynamic = "force-dynamic";

export default async function StaffSettingsPage() {
  await requireAdmin();

  const [users, inviteConfig] = await Promise.all([getStaffUsersAdmin(), getStaffInviteConfig()]);
  const preview = buildStaffInvitationPreview({
    name: users[0]?.name || "Nome collega",
    nickname: users[0]?.nickname || "nome.cognome",
    subject: inviteConfig.subject,
    template: inviteConfig.template,
    accessBaseUrl: inviteConfig.accessBaseUrl
  });
  const readyUsers = users.filter((user) => user.active).length;
  const pendingInviteUsers = users.filter((user) => user.active && !user.inviteSentAt).length;
  const adminUsers = users.filter((user) => user.role === "ADMIN").length;

  return (
    <div className="stack">
      <PageHeader
        title="Profili Staff"
        description="Area admin per profilare i colleghi con nickname, password iniziale ed email. L'invito mail e gia predisposto ma il link finale verra collegato nel prossimo step."
      />

      <section className="grid stats-grid">
        <article className="card card-pad compact-metric compact-metric-neutral">
          <span className="compact-metric-label">Utenti attivi</span>
          <strong>{readyUsers}</strong>
          <span className="hint">Profili staff pronti all'accesso</span>
        </article>
        <article className="card card-pad compact-metric compact-metric-brand">
          <span className="compact-metric-label">Admin</span>
          <strong>{adminUsers}</strong>
          <span className="hint">Profili con permessi completi</span>
        </article>
        <article className="card card-pad compact-metric compact-metric-warning">
          <span className="compact-metric-label">Inviti da finalizzare</span>
          <strong>{pendingInviteUsers}</strong>
          <span className="hint">
            {inviteConfig.accessLoginUrl
              ? "Profili con invito pronto al collegamento mail."
              : "In attesa del link ufficiale di accesso."}
          </span>
        </article>
      </section>

      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Nuovo profilo</h3>
              <p className="card-muted">Crea il profilo collega e prepara nickname e credenziali iniziali.</p>
            </div>
          </div>
          <StaffProfileForm />
        </section>

        <section className="card card-pad">
          <div className="list-header">
            <div>
              <h3>Invito email</h3>
              <p className="card-muted">Bozza pronta per il prossimo step, senza ancora fissare il link definitivo.</p>
            </div>
            <span className={`pill ${inviteConfig.accessLoginUrl ? "status" : "warning"}`}>
              {inviteConfig.accessLoginUrl ? "URL pronto" : "URL da configurare"}
            </span>
          </div>

          {!inviteConfig.accessLoginUrl ? (
            <div className="empty">
              Il link ufficiale di accesso non e ancora configurato. La profilazione utenti e pronta, ma la mail automatica verra attivata quando decideremo la destinazione stabile.
            </div>
          ) : null}

          <div className="stack staff-invite-preview">
            <div className="field full">
              <label htmlFor="staff-invite-subject">Oggetto</label>
              <input id="staff-invite-subject" readOnly value={preview.subject} />
            </div>
            <div className="field full">
              <label htmlFor="staff-invite-body">Bozza messaggio</label>
              <textarea id="staff-invite-body" readOnly value={preview.body} />
            </div>
            <div className="mini-item">
              <strong>Link previsto</strong>
              <div className="subtle">{preview.accessLoginUrl || "Da configurare nel prossimo passaggio"}</div>
            </div>
          </div>
        </section>
      </div>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Staff registrato</h3>
            <p className="card-muted">Elenco profili gia creati, con stato invito pronto per il deploy definitivo.</p>
          </div>
          <Link className="button ghost" href="/settings">
            Torna a impostazioni
          </Link>
        </div>

        <div className="stack">
          {users.length === 0 ? (
            <div className="empty">Nessun profilo staff ancora creato.</div>
          ) : (
            users.map((user) => (
              <article className="mini-item staff-user-card" key={user.id}>
                <div className="list-header">
                  <div>
                    <strong>{user.name}</strong>
                    <div className="subtle">
                      @{user.nickname} • {user.email}
                    </div>
                  </div>
                  <div className="staff-user-pills">
                    <span className="pill">{userRoleLabels[user.role]}</span>
                    <span className={`pill ${user.active ? "status" : "danger"}`}>
                      {user.active ? "Attivo" : "Disattivato"}
                    </span>
                    <span className={`pill ${user.inviteSentAt ? "status" : "warning"}`}>
                      {user.inviteSentAt
                        ? `Invito inviato ${formatDate(user.inviteSentAt)}`
                        : inviteConfig.accessLoginUrl
                          ? "Invito pronto"
                          : "In attesa URL"}
                    </span>
                  </div>
                </div>
                <div className="hint">
                  Creato il {formatDate(user.createdAt)}
                  {user.invitePreparedAt ? ` • Profilazione pronta dal ${formatDate(user.invitePreparedAt)}` : ""}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
