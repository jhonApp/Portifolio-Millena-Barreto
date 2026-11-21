import { handleResultLink } from "./handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleResultLink(request);
}
