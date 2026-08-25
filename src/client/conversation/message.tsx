import { SparkleIcon } from "@phosphor-icons/react";
import type { FlueConversationMessage, FlueConversationPart } from "@flue/sdk";

export function Message({ message }: { message: FlueConversationMessage }) {
  const isUser = message.role === "user";
  return (
    <article className={`message ${isUser ? "user" : "assistant"}`}>
      {!isUser ? (
        <div className="message-avatar">
          <SparkleIcon weight="fill" />
        </div>
      ) : null}
      <div className="message-content">
        {message.parts.map((part, index) => (
          <MessagePart key={partKey(part, index)} part={part} />
        ))}
      </div>
    </article>
  );
}

function MessagePart({ part }: { part: FlueConversationPart }) {
  switch (part.type) {
    case "text":
      return <p>{part.text}</p>;
    case "reasoning":
      return (
        <details className="reasoning">
          <summary>Thinking</summary>
          <p>{part.text}</p>
        </details>
      );
    case "dynamic-tool":
      return (
        <details className="tool-call">
          <summary>Used {part.toolName}</summary>
          <pre>{JSON.stringify(part, null, 2)}</pre>
        </details>
      );
    case "file":
      return <span>Attachment ({part.mediaType})</span>;
    default:
      return null;
  }
}

function partKey(part: FlueConversationPart, index: number): string {
  if (part.type === "dynamic-tool") return part.toolCallId;
  if (part.type === "file" && part.id) return part.id;
  return `${part.type}:${index}`;
}
