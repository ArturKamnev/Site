import { app } from "./app";
import { env } from "./config/env";
import { initDb } from "./lib/db";

const start = async () => {
  await initDb();
  app.listen(env.PORT, () => {
    console.log(`API server started on http://localhost:${env.PORT}`);
  });
};

start().catch((error) => {
  console.error("Failed to start API server", error);
  process.exit(1);
});
