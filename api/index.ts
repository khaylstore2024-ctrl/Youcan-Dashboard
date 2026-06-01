// Set a global flag so server.ts knows it is being imported as a serverless function
(global as any).__is_serverless_handler = true;

import app from "../server";

export default app;
