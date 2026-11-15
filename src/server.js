import { createApp } from "./app.js";
const port = Number(process.env.PORT || 4000);
const server = createApp().listen(port, () =>
  console.log(`Orthodoxy in Kurdistan API listening on ${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
