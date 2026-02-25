import { neonConfig } from "@neondatabase/serverless";

export function register() {
  if (process.env.NODE_ENV === "development" || process.env.NEON_LOCAL === "true") {
    neonConfig.wsProxy = (host) => `localhost:5433/v1?address=${host}:5432`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }
}
