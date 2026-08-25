import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { FilesPanel } from "./files-panel.tsx";
import { SignInsPanel } from "./sign-ins-panel.tsx";

const workspaceTabs = [
  { value: "browser", label: "Sign-ins" },
  { value: "files", label: "Files" },
];

export default function WorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const [tab, setTab] = useState("browser");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="workspace-dialog" size="xl">
        <div className="dialog-heading workspace-heading">
          <div>
            <Dialog.Title className="dialog-title">Workspace</Dialog.Title>
            <Dialog.Description className="dialog-description">
              Shared files and saved sign-ins are available to every teammate.
            </Dialog.Description>
          </div>
          <Dialog.Close
            render={(closeProps) => (
              <Button
                {...closeProps}
                variant="ghost"
                shape="square"
                icon={<XIcon />}
                aria-label="Close workspace"
              />
            )}
          />
        </div>
        <Tabs tabs={workspaceTabs} value={tab} onValueChange={setTab} />
        <SignInsPanel active={tab === "browser"} />
        <FilesPanel hidden={tab !== "files"} />
      </Dialog>
    </Dialog.Root>
  );
}
