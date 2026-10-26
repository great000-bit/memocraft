import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { Avatar } from "@/components/workspace/Avatar";
import { InviteControls, InviteForm, MemberControls, MembershipControls } from "@/components/team/TeamForms";
import { requireUser } from "@/lib/session";
import { getWorkspace, listTeam, listWorkspaces, roleLabel, teamSizeLimit } from "@/lib/team";
import styles from "@/components/workspace/Workspace.module.css";
import panels from "@/components/workspace/Settings.module.css";
import team from "@/components/team/Team.module.css";

export const metadata: Metadata = { title: "Team" };

// Only a Google picture can be shown to someone else; an uploaded one sits behind its owner's sign-in.
const shareable = (image: string | null) => (image && /^https:\/\//.test(image) ? image : null);

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

async function TeamPanels() {
  const user = await requireUser();
  const [{ members, invites }, choices, current] = await Promise.all([listTeam(user.id), listWorkspaces(user), getWorkspace()]);
  const others = choices.filter((choice) => choice.ownerId !== user.id);
  const full = members.length + invites.length >= teamSizeLimit;

  return (
    <div className={panels.panels}>
      <section className={panels.panel} aria-labelledby="invite-title">
        <h2 id="invite-title" className={panels.panelTitle}>
          Invite someone to your workspace
        </h2>
        <ul className={team.roles}>
          <li>
            <strong>Edit</strong>: create and publish deliveries, upload, and organise your files in Explorer.
          </li>
          <li>
            <strong>View only</strong>: see your deliveries, proof of delivery and files, and change nothing.
          </li>
        </ul>
        <p className={panels.panelText}>
          They sign in with Google using the address you type. Their work uses your storage and shows your studio name to
          clients. Your profile, settings and team stay yours alone.
        </p>
        <InviteForm disabled={full} />
        {full && <p className={panels.panelText}>A team can have up to {teamSizeLimit} people for now. Remove someone or cancel an invite to add another.</p>}
      </section>

      <section className={panels.panel} aria-labelledby="members-title">
        <h2 id="members-title" className={panels.panelTitle}>
          Your team
        </h2>
        {members.length === 0 && invites.length === 0 ? (
          <p className={panels.panelText}>Just you so far.</p>
        ) : (
          <ul className={team.people}>
            {members.map((member) => (
              <li key={member.userId} className={team.person}>
                <span className={team.who}>
                  <Avatar name={member.name} image={shareable(member.image)} size={36} />
                  <span className={team.whoText}>
                    <span className={team.whoName}>{member.name}</span>
                    <span className={team.whoEmail}>{member.email}</span>
                  </span>
                </span>
                <MemberControls memberId={member.userId} role={member.role} name={member.name} />
              </li>
            ))}
            {invites.map((invite) => (
              <li key={invite.id} className={team.person}>
                <span className={team.who}>
                  <Avatar name={invite.email} size={36} />
                  <span className={team.whoText}>
                    <span className={team.whoName}>{invite.email}</span>
                    <span className={team.whoEmail}>
                      Invited {dateFormat.format(invite.createdAt)} to {invite.role === "editor" ? "edit" : "view"}. Waiting for them to join.
                    </span>
                  </span>
                </span>
                <InviteControls inviteId={invite.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section className={panels.panel} aria-labelledby="joined-title">
          <h2 id="joined-title" className={panels.panelTitle}>
            Teams you are on
          </h2>
          <ul className={team.people}>
            {others.map((choice) => (
              <li key={choice.ownerId} className={team.person}>
                <span className={team.who}>
                  <Avatar name={choice.name} size={36} />
                  <span className={team.whoText}>
                    <span className={team.whoName}>{choice.name}</span>
                    <span className={team.whoEmail}>{roleLabel[choice.role]}</span>
                  </span>
                  {current.ownerId === choice.ownerId && <span className={team.badge}>Open now</span>}
                </span>
                <MembershipControls ownerId={choice.ownerId} current={current.ownerId === choice.ownerId} teamName={choice.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>Team</h1>
      </div>
      <p className={styles.sub}>Bring an assistant, second shooter or editor into your workspace, and switch into the teams you are on.</p>
      <Suspense fallback={<PageSkeleton blocks={2} />}>
        <TeamPanels />
      </Suspense>
    </>
  );
}
