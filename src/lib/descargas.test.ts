import { afterEach, describe, expect, it, vi } from "vitest";
import { descargarBlob } from "./descargas";

describe("descargarBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("crea un enlace temporal con el nombre del archivo, lo pulsa y libera la URL", () => {
    vi.useFakeTimers();
    const crear = vi.fn(() => "blob:fake");
    const liberar = vi.fn();
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: liberar });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    descargarBlob(new Blob(["x"]), "reporte.pdf");

    expect(crear).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    const enlace = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(enlace.download).toBe("reporte.pdf");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(liberar).toHaveBeenCalledWith("blob:fake");
  });
});
