import { Button } from "@cloudflare/kumo/components/button";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { FolderSimpleIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { listDirectory } from "./api.ts";

export function FilesPanel({ hidden }: { hidden: boolean }) {
  const [path, setPath] = useState("/workspace");
  const [entries, setEntries] = useState<string[]>([]);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const openDirectory = useCallback(async (nextPath: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const listing = await listDirectory(nextPath, controller.signal);
      setPath(listing.path);
      setEntries(listing.entries);
      setError("");
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setEntries([]);
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      }
    }
  }, []);

  useEffect(() => {
    void openDirectory("/workspace");
    return () => requestRef.current?.abort();
  }, [openDirectory]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void openDirectory(path);
  }

  return (
    <section className="workspace-panel" hidden={hidden}>
      <div className="workspace-section-heading">
        <div>
          <h2>Shared files</h2>
          <p>Everything here is visible to every teammate.</p>
        </div>
      </div>
      <form className="path-bar" onSubmit={submit}>
        <Input
          aria-label="Workspace path"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
        <Button type="submit">Open</Button>
      </form>
      <div className="file-list">
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        {!error && entries.length === 0 ? (
          <Empty
            size="sm"
            icon={<FolderSimpleIcon size={32} />}
            title="This folder is empty"
          />
        ) : (
          entries.map((entry) => (
            <div key={entry} className="file-row">
              <FolderSimpleIcon />
              <code>{entry}</code>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
