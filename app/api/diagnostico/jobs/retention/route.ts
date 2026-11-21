import { handleRetentionJob } from "./handler";

export const dynamic = "force-dynamic";
// Erasing a batch of customers touches the database and the storage: allow the Vercel maximum.
export const maxDuration = 60;

// Vercel Cron calls this route with GET once a day (see vercel.json).
export async function GET(request: Request): Promise<Response> {
  return handleRetentionJob(request);
}
