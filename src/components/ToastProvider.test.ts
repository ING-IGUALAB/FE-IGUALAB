import { describe, expect, it } from "vitest";
import { useToast } from "./ToastProvider";

describe("useToast", () => {
  it("devuelve SIEMPRE la misma referencia (evita bucles en useEffect/useCallback)", () => {
    const a = useToast();
    const b = useToast();
    expect(a).toBe(b);
    expect(typeof a).toBe("function");
  });
});
