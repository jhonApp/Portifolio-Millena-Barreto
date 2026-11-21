import { handleGenerationJob } from "./handler";

export const dynamic = "force-dynamic";
// Generating a PDF takes a few seconds; Vercel Pro allows up to 60.
export const maxDuration = 60;

// Vercel Cron calls this route with GET every minute (see vercel.json).
export async function GET(request: Request): Promise<Response> {
  return handleGenerationJob(request);
}
