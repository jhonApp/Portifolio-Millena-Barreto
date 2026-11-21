// Integration tests never reach a real e-mail provider: the development provider is on and writes
// to a temporary folder. Tests that need the real selection override this with vi.stubEnv.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.ENABLE_EMAIL_SIMULATION = "true";
process.env.EMAIL_SIMULATION_FAIL = "false";
process.env.LOCAL_MAIL_DIR = mkdtempSync(path.join(tmpdir(), "diagnostico-mail-"));
