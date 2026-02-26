import { spawn } from "node:child_process";
import type { PricingExecutionResult, PricingRunner } from "../../application/pricing/ports/pricing.js";

const sanitizeStderr = (stderr: string): string => {
  const trimmed = stderr.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const firstLine = trimmed.split("\n").at(0) ?? "";
  if (firstLine.includes("Traceback")) {
    return "Pricing program failed";
  }
  return firstLine.slice(0, 512);
};

export class PythonPricingRunner implements PricingRunner {
  public async execute(input: {
    fileRef: string;
    requestJson: Record<string, unknown>;
    timeoutMs: number;
    maxOutputBytes: number;
  }): Promise<PricingExecutionResult> {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn("python3", [input.fileRef], { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, input.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > input.maxOutputBytes) {
          child.kill("SIGKILL");
          return;
        }
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes <= input.maxOutputBytes) {
          stderr += chunk.toString("utf8");
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startedAt;

        if (timedOut) {
          reject(new Error("Pricing execution timed out"));
          return;
        }

        if (stdoutBytes > input.maxOutputBytes) {
          reject(new Error("Pricing execution output exceeded maximum size"));
          return;
        }

        if (code !== 0) {
          reject(new Error(sanitizeStderr(stderr) || "Pricing execution failed"));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as Record<string, unknown>;
          resolve({
            responseJson: parsed,
            durationMs,
            stderr: sanitizeStderr(stderr),
          });
        } catch {
          reject(new Error("Pricing response was not valid JSON"));
        }
      });

      child.stdin.write(JSON.stringify(input.requestJson));
      child.stdin.end();
    });
  }
}
