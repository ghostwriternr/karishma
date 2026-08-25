import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  FolderSimpleIcon,
  PlusIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { BotAvatar } from "./bot-avatar.tsx";
import { checkService } from "./health.ts";
import type { Bot } from "./roster.ts";

type TeamRailProps = {
  bots: Bot[];
  selectedId: string | null;
  createOpen: boolean;
  onCreateOpenChange(open: boolean): void;
  onCreate(name: string): Bot | null;
  onSelect(conversationId: string): void;
  onOpenWorkspace(): void;
};

export function TeamRail(props: TeamRailProps) {
  const [newName, setNewName] = useState("");
  const [serviceStatus, setServiceStatus] = useState<"checking" | "online" | "offline">(
    "checking",
  );
  const toasts = useKumoToastManager();

  useEffect(() => {
    const controller = new AbortController();
    checkService(controller.signal)
      .then(() => setServiceStatus("online"))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setServiceStatus("offline");
        }
      });
    return () => controller.abort();
  }, []);

  function createBot(event: FormEvent) {
    event.preventDefault();
    const bot = props.onCreate(newName);
    if (!bot) return;
    setNewName("");
    props.onCreateOpenChange(false);
    toasts.add({ title: `${bot.name} joined your team`, variant: "success" });
  }

  const createButton = (mobile = false) => (
    <Button
      variant="ghost"
      shape="square"
      size={mobile ? "base" : "xs"}
      icon={<PlusIcon />}
      aria-label="Create teammate"
      onClick={() => props.onCreateOpenChange(true)}
    />
  );

  return (
    <aside className="team-rail">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">K</div>
        <span>Karishma</span>
        <div className="mobile-actions">
          {createButton(true)}
          <Button
            variant="ghost"
            shape="square"
            icon={<FolderSimpleIcon />}
            aria-label="Open workspace"
            onClick={props.onOpenWorkspace}
          />
        </div>
      </div>

      <div className="rail-heading">
        <span>Teammates</span>
        {createButton()}
      </div>

      <nav className="roster" aria-label="Teammates">
        {props.bots.length === 0 ? (
          <div className="roster-empty">
            <UsersThreeIcon size={20} />
            <span>No teammates yet</span>
          </div>
        ) : (
          props.bots.map((bot) => (
            <button
              key={bot.conversationId}
              type="button"
              className={`roster-item ${bot.conversationId === props.selectedId ? "active" : ""}`}
              onClick={() => props.onSelect(bot.conversationId)}
            >
              <BotAvatar name={bot.name} />
              <span className="bot-name">{bot.name}</span>
            </button>
          ))
        )}
      </nav>

      <div className="rail-footer">
        <Button
          variant="ghost"
          className="workspace-trigger"
          icon={<FolderSimpleIcon />}
          onClick={props.onOpenWorkspace}
        >
          Workspace
        </Button>
        <div className="service-state" title={`Service is ${serviceStatus}`}>
          <span className={`service-dot ${serviceStatus}`} />
          {serviceStatus === "offline" ? "Disconnected" : "Cloudflare"}
        </div>
      </div>

      <Dialog.Root open={props.createOpen} onOpenChange={props.onCreateOpenChange}>
        <Dialog className="create-dialog">
          <div className="dialog-heading">
            <div>
              <Dialog.Title className="dialog-title">Create a teammate</Dialog.Title>
              <Dialog.Description className="dialog-description">
                Give them a name. Their conversation will stay with them.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={(closeProps) => (
                <Button
                  {...closeProps}
                  variant="ghost"
                  shape="square"
                  icon={<XIcon />}
                  aria-label="Close"
                />
              )}
            />
          </div>
          <form className="create-form" onSubmit={createBot}>
            <Input
              autoFocus
              label="Name"
              placeholder="For example, Mira"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <div className="dialog-actions">
              <Dialog.Close render={(closeProps) => <Button {...closeProps}>Cancel</Button>} />
              <Button type="submit" variant="primary" disabled={!newName.trim()}>
                Create teammate
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </aside>
  );
}
