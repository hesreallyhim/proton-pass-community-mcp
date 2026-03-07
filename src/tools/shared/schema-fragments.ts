import { z } from "zod";

export const confirmInput = z
  .boolean()
  .optional()
  .describe("Must be true to execute the write operation");
