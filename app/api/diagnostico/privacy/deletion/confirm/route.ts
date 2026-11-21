import { handleDeletionConfirm } from "./handler";

export const dynamic = "force-dynamic";
// The erasure removes files and rows inside the request.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleDeletionConfirm(request);
}
