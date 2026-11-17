import { createApp } from "./app.js";
// Content import is an explicit, insert-only migration. Server restarts never rewrite editorial content.
const port = Number(process.env.PORT || 4000);
const server = createApp().listen(port, () =>
  console.log(`Orthodoxy in Kurdistan API listening on ${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
