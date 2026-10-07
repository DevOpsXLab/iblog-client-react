import { toast as sonner } from "sonner";
import { errorMessage } from "@/shared/http/problem";

export const toast = {
  ok: (m: string) => sonner(m),
  error: (e: unknown) => sonner.error(typeof e === "string" ? e : errorMessage(e), { duration: 6000 }),
};
