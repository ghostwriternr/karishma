import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  ArrowSquareOutIcon,
  BrowserIcon,
  CheckIcon,
  SignInIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SessionRecord, StartHandoffInput } from "../../shared/api-contract.ts";
import {
  completeSignIn,
  listSignIns,
  removeSignIn,
  startSignIn,
} from "./api.ts";
import { sessionPresentation } from "./session-presentation.ts";

const emptyForm: StartHandoffInput = { startUrl: "" };

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function upsertSession(sessions: SessionRecord[], session: SessionRecord): SessionRecord[] {
  const index = sessions.findIndex((candidate) => candidate.id === session.id);
  if (index === -1) return [...sessions, session];
  return sessions.map((candidate, candidateIndex) =>
    candidateIndex === index ? session : candidate,
  );
}

export function SignInsPanel({ active }: { active: boolean }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [form, setForm] = useState<StartHandoffInput>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [handoffSession, setHandoffSession] = useState<SessionRecord | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refreshRef = useRef<AbortController | null>(null);
  const toasts = useKumoToastManager();

  const refresh = useCallback(async () => {
    refreshRef.current?.abort();
    const controller = new AbortController();
    refreshRef.current = controller;
    try {
      const result = await listSignIns(controller.signal);
      setSessions(result.sessions);
      setError("");
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      }
    }
  }, []);

  useEffect(() => {
    if (!active) {
      refreshRef.current?.abort();
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => {
      window.clearInterval(timer);
      refreshRef.current?.abort();
    };
  }, [active, refresh]);

  const currentHandoff = useMemo(() => {
    if (!handoffSession) return null;
    return sessions.find((session) => session.id === handoffSession.id) ?? handoffSession;
  }, [handoffSession, sessions]);

  function setFormField<Key extends keyof StartHandoffInput>(
    key: Key,
    value: StartHandoffInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function beginSignIn(event: FormEvent) {
    event.preventDefault();
    let url: URL;
    try {
      url = new URL(form.startUrl.trim());
    } catch {
      setError("Enter a complete https:// address.");
      return;
    }
    if (url.protocol !== "https:") {
      setError("Enter a complete https:// address.");
      return;
    }

    setPending("start");
    setError("");
    try {
      const result = await startSignIn({
        ...form,
        id: form.id?.trim() || undefined,
        label: form.label?.trim() || undefined,
        startUrl: url.toString(),
      });
      setSessions((current) => upsertSession(current, result.session));
      setHandoffSession(result.session);
      setForm(emptyForm);
      setShowForm(false);
      if (result.liveViewUrl) {
        window.open(result.liveViewUrl, "_blank", "noopener,noreferrer");
      }
      void refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setPending(null);
    }
  }

  async function saveSignIn(id: string) {
    setPending(`complete:${id}`);
    setError("");
    try {
      const result = await completeSignIn(id);
      setSessions((current) => upsertSession(current, result.session));
      if (handoffSession?.id === id) setHandoffSession(null);
      toasts.add({
        title: "Sign-in saved",
        description: "Your teammate can use it now.",
        variant: "success",
      });
      void refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setPending(null);
    }
  }

  async function deleteSignIn(id: string) {
    setPending(`delete:${id}`);
    setError("");
    try {
      await removeSignIn(id);
      setSessions((current) => current.filter((session) => session.id !== id));
      if (handoffSession?.id === id) setHandoffSession(null);
      toasts.add({ title: "Sign-in removed" });
      void refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="workspace-panel" hidden={!active}>
      <div className="workspace-section-heading">
        <div>
          <h2>Saved sign-ins</h2>
          <p>Save access to a website for your team. Every teammate can use saved sign-ins.</p>
        </div>
        {sessions.length > 0 || showForm ? (
          <Button icon={<SignInIcon />} onClick={() => setShowForm((value) => !value)}>
            Add sign-in
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <form className="sign-in-form" onSubmit={beginSignIn}>
          <Input
            label="Name"
            placeholder="Work email"
            value={form.label ?? ""}
            onChange={(event) => setFormField("label", event.target.value)}
          />
          <Input
            label="Website"
            placeholder="https://example.com/login"
            value={form.startUrl}
            onChange={(event) => setFormField("startUrl", event.target.value)}
          />
          <details className="advanced-fields">
            <summary>Advanced</summary>
            <Input
              label="Session ID"
              description="Optional stable identifier"
              placeholder="work-email"
              value={form.id ?? ""}
              onChange={(event) => setFormField("id", event.target.value)}
            />
          </details>
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={<ArrowSquareOutIcon />}
              loading={pending === "start"}
              disabled={pending !== null}
            >
              Open browser
            </Button>
          </div>
        </form>
      ) : null}

      {currentHandoff?.liveViewUrl &&
      sessionPresentation[currentHandoff.status].canSave ? (
        <div className="handoff-banner">
          <div>
            <strong>Finish signing in</strong>
            <span>Complete the sign-in in the browser window, then save it here.</span>
          </div>
          <LinkButton
            href={currentHandoff.liveViewUrl}
            target="_blank"
            rel="noreferrer"
            icon={<ArrowSquareOutIcon />}
          >
            Reopen browser
          </LinkButton>
        </div>
      ) : null}

      {error ? <p className="inline-error" role="alert">{error}</p> : null}

      {sessions.length === 0 && !showForm ? (
        <Empty
          size="sm"
          icon={<BrowserIcon size={32} />}
          title="No saved sign-ins"
          description="Add one when your team needs access to a website behind a login."
          contents={
            <Button icon={<SignInIcon />} onClick={() => setShowForm(true)}>
              Add sign-in
            </Button>
          }
        />
      ) : (
        <div className="session-list">
          {sessions.map((session) => {
            const presentation = sessionPresentation[session.status];
            return (
              <div key={session.id} className="session-card">
                <div className="session-icon"><BrowserIcon /></div>
                <div className="session-copy">
                  <div className="session-title">
                    <strong>{session.label || session.id}</strong>
                    <Badge variant={presentation.badge} appearance="dot">
                      {presentation.label}
                    </Badge>
                  </div>
                  <span>{hostname(session.startUrl)}</span>
                  {session.error ? <p className="inline-error">{session.error}</p> : null}
                </div>
                <div className="session-actions">
                  {session.liveViewUrl ? (
                    <LinkButton
                      variant="ghost"
                      shape="square"
                      href={session.liveViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      icon={<ArrowSquareOutIcon />}
                      aria-label="Open browser"
                    />
                  ) : null}
                  {presentation.canSave ? (
                    <Button
                      icon={<CheckIcon />}
                      loading={pending === `complete:${session.id}`}
                      disabled={pending !== null}
                      onClick={() => void saveSignIn(session.id)}
                    >
                      Save sign-in
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    shape="square"
                    icon={<TrashIcon />}
                    aria-label={`Remove ${session.label || session.id}`}
                    loading={pending === `delete:${session.id}`}
                    disabled={pending !== null}
                    onClick={() => void deleteSignIn(session.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
