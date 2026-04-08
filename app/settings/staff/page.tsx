import { headers } from "next/headers";
import Link from "next/link";
import { StaffInviteSettingsForm } from "@/components/staff-invite-settings-form";
import { StaffProfileForm } from "@/components/staff-profile-form";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getMailDeliveryConfig } from "@/lib/mail";
import { getRequestBaseUrl } from "@/lib/request-url";
import { userRoleLabels } from "@/lib/constants";
import {
  buildStaffInvitationPreview,
  getStaffInviteConfig,
  getStaffUsersAdmin
} from "@/lib/staff-users";

export const dynamic = "force-dynamic";

export default async function StaffSettingsPage() {
  await requireAdmin();

  const requestBaseUrl = getRequestBaseUrl(headers());
  const [users, inviteConfig] = await Promise.all([
    getStaffUsersAdmin(),
    getStaffInviteConfig({ requestBaseUrl })
  ]);
  const mailDelivery = getMailDeliveryConfig();
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
        description="Area admin per profilare i colleghi con nickname, password iniziale ed email. Il link di accesso viene ricavato dal dominio attuale o dalla configurazione deploy."
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
            {mailDelivery.enabled
              ? "Le nuove profilazioni provano a inviare subito la mail."
              : "Il link e pronto, ma serve configurare il provider mail per l'invio automatico."}
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
              <p className="card-muted">
                Puoi personalizzare oggetto, testo e dominio del link. La profilazione usera questa bozza anche per
                l'invio automatico quando il provider mail e attivo.
              </p>
            </div>
            <div className="staff-user-pills">
              <span className={`pill ${inviteConfig.accessLoginUrl ? "status" : "warning"}`}>
                {inviteConfig.accessLoginUrl ? "Link accesso pronto" : "Link accesso assente"}
              </span>
              <span className={`pill ${mailDelivery.enabled ? "status" : "warning"}`}>
                {mailDelivery.enabled ? "Mail automatica attiva" : "Provider mail da configurare"}
              </span>
            </div>
          </div>

          {!inviteConfig.accessLoginUrl ? (
            <div className="empty">
              Non riesco a ricavare un dominio valido per il link di accesso. Imposta STAFF_ACCESS_BASE_URL oppure usa l'app dal dominio definitivo del deploy.
            </div>
          ) : null}

          {!mailDelivery.enabled ? (
            <div className="empty">
              Per inviare davvero la mail dopo la profilazione servono le env <code>RESEND_API_KEY</code> e <code>MAIL_FROM</code>. Intanto il profilo viene creato e la bozza resta pronta con il link corretto.
            </div>
          ) : null}

          <StaffInviteSettingsForm
            accessBaseUrl={inviteConfig.accessBaseUrl || ""}
            previewAccessLoginUrl={preview.accessLoginUrl}
            previewBody={preview.body}
            subject={inviteConfig.subject}
            template={inviteConfig.template}
          />
        </section>
      </div>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Staff registrato</h3>
            <p className="card-muted">Elenco profili gia creati, con stato reale del link e dell'invio mail.</p>
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
                          ? mailDelivery.enabled
                            ? "Pronto per invio automatico"
                            : "Link pronto, mail non attiva"
                          : "In attesa link"}
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
