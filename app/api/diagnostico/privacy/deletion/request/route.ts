import { handleDeletionRequest } from "./handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleDeletionRequest(request);
}
