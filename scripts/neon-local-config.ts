import { neonConfig } from "@neondatabase/serverless";

neonConfig.wsProxy = (host) => `localhost:5433/v1?address=${host}:5432`;
neonConfig.useSecureWebSocket = false;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;
