import express, { Application, Request, Response } from "express";
import cors from "cors";
import { router } from "./routes.js";

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
