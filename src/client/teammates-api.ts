import { z } from "zod";
import type { DeleteTeammateResponse } from "../shared/api-contract.ts";

const deleteTeammateResponseSchema: z.ZodType<DeleteTeammateResponse> = z.object({
  ok: z.literal(true),
  conversationId: z.string(),
});

const errorResponseSchema = z.object({ error: z.string() });

export async function deleteTeammate(
  conversationId: string,
): Promise<DeleteTeammateResponse> {
  const response = await fetch(
    `/api/teammates/${encodeURIComponent(conversationId)}`,
    { method: "DELETE" },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const errorBody = errorResponseSchema.safeParse(body);
    throw new Error(
      errorBody.success ? errorBody.data.error : "Could not delete teammate",
    );
  }
  const parsed = deleteTeammateResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid delete response");
  return parsed.data;
}
