import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { InputArea } from "@cloudflare/kumo/components/input";
import { useFlueAgent } from "@flue/react";
import {
  DotsThreeIcon,
  FolderSimpleIcon,
  SparkleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { BotAvatar } from "../bot-avatar.tsx";
import type { Bot } from "../roster.ts";
import { Message } from "./message.tsx";

const suggestedPrompts = [
  "What can you help me with?",
  "Look around the shared workspace",
  "Help me plan my next project",
];

type ConversationProps = {
  bot: Bot;
  onDelete(conversationId: string): Promise<void>;
  onOpenWorkspace(): void;
};

export function Conversation({ bot, onDelete, onOpenWorkspace }: ConversationProps) {
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const agent = useFlueAgent({
    url: `/api/agents/teammate/${encodeURIComponent(bot.conversationId)}`,
  });
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const latestMessage = agent.messages.at(-1);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [latestMessage]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const message = input.trim();
    if (!message) return;
    setInput("");
    setSendError(undefined);
    try {
      await agent.sendMessage(message);
    } catch (error) {
      setInput(message);
      setSendError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  function choosePrompt(prompt: string) {
    setInput(prompt);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function deleteBot() {
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(bot.conversationId);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
      setDeleting(false);
    }
  }

  return (
    <main className="conversation">
      <header className="conversation-header">
        <div className="conversation-identity">
          <BotAvatar name={bot.name} large />
          <div>
            <h1>{bot.name}</h1>
            <p>{busy ? "Thinking…" : "Your teammate"}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                variant="ghost"
                shape="square"
                icon={<DotsThreeIcon weight="bold" />}
                aria-label={`${bot.name} options`}
              />
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item icon={FolderSimpleIcon} onClick={onOpenWorkspace}>
              Open workspace
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              icon={TrashIcon}
              variant="danger"
              onClick={() => setDeleteOpen(true)}
            >
              Delete teammate
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </header>

      <Dialog.Root
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteOpen(open);
          if (!open) setDeleteError("");
        }}
        role="alertdialog"
      >
        <Dialog className="create-dialog delete-dialog">
          <Dialog.Title className="dialog-title">Delete {bot.name}?</Dialog.Title>
          <Dialog.Description className="dialog-description">
            This permanently deletes this teammate’s conversation and private agent
            state. Files in the shared workspace stay available to other teammates.
          </Dialog.Description>
          {deleteError ? <p className="inline-error">{deleteError}</p> : null}
          <div className="dialog-actions">
            <Dialog.Close
              render={(closeProps) => (
                <Button {...closeProps} disabled={deleting}>Cancel</Button>
              )}
            />
            <Button
              variant="destructive"
              loading={deleting}
              disabled={deleting}
              onClick={() => void deleteBot()}
            >
              Delete teammate
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <div className="message-scroll" aria-live="polite">
        <div className="message-column">
          {agent.messages.length === 0 ? (
            <div className="conversation-empty">
              <span className="empty-spark"><SparkleIcon weight="fill" /></span>
              <h2>What should {bot.name} work on?</h2>
              <p>Ask for research, a plan, or work in the shared computer.</p>
              <div className="prompt-list">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => choosePrompt(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            agent.messages.map((message) => <Message key={message.id} message={message} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="composer-wrap">
        <form className="composer" onSubmit={submit}>
          <InputArea
            ref={composerRef}
            aria-label={`Message ${bot.name}`}
            placeholder={`Message ${bot.name}`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            autoResize
            minRows={1}
            maxRows={6}
          />
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={!input.trim() || busy}
          >
            Send
          </Button>
        </form>
        <p className="composer-hint">Enter to send · Shift + Enter for a new line</p>
      </div>

      {sendError || agent.error ? (
        <div className="error-banner" role="alert">
          <strong>Something went wrong</strong>
          <span>{sendError ?? agent.error?.message}</span>
          {sendError ? (
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setSendError(undefined)}
            >
              <XIcon />
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
