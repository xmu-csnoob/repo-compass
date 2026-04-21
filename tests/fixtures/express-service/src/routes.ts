import { Router, Request, Response } from "express";

export const router = Router();

router.get("/users", (_req: Request, res: Response) => {
  res.json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

router.get("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  res.json({ id, name: "User " + id });
});

router.post("/users", (req: Request, res: Response) => {
  const { name } = req.body;
  res.status(201).json({ id: Date.now(), name });
});
