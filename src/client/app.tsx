import { Button } from "@cloudflare/kumo/components/button";
import { PlusIcon } from "@phosphor-icons/react";
import { lazy, Suspense, useState } from "react";
import { Conversation } from "./conversation/conversation.tsx";
import { useRoster } from "./roster.ts";
import { TeamRail } from "./team-rail.tsx";
import { deleteTeammate } from "./teammates-api.ts";

const WorkspaceDialog = lazy(() => import("./workspace/workspace-dialog.tsx"));

export function App() {
  const roster = useRoster();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceVisited, setWorkspaceVisited] = useState(false);

  function openWorkspace() {
    setWorkspaceVisited(true);
    setWorkspaceOpen(true);
  }

  async function removeTeammate(conversationId: string) {
    await deleteTeammate(conversationId);
    roster.remove(conversationId);
  }

  return (
    <div className="app-shell">
      <TeamRail
        bots={roster.bots}
        selectedId={roster.selectedId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
        onCreate={roster.create}
        onSelect={roster.select}
        onOpenWorkspace={openWorkspace}
      />

      {roster.selected ? (
        <Conversation
          key={roster.selected.conversationId}
          bot={roster.selected}
          onDelete={removeTeammate}
          onOpenWorkspace={openWorkspace}
        />
      ) : (
        <main className="conversation">
          <div className="welcome">
            <div className="welcome-mark">K</div>
            <h1>Bring in your first teammate</h1>
            <p>
              Give them a name. Their work, context, and conversation will be here when
              you return.
            </p>
            <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)}>
              Create teammate
            </Button>
          </div>
        </main>
      )}

      {workspaceVisited ? (
        <Suspense fallback={null}>
          <WorkspaceDialog open={workspaceOpen} onOpenChange={setWorkspaceOpen} />
        </Suspense>
      ) : null}
    </div>
  );
}
