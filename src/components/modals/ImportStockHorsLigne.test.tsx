import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PontDesktop } from "@/lib/caisse/contrat_desktop";
import ImportStockModal from "./ImportStockModal";

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ notifier: vi.fn() }),
  messageErreurPour: (_e: unknown, repli: string) => repli,
}));

afterEach(() => {
  cleanup();
  delete window.medconnecteDesktop;
  vi.clearAllMocks();
});

function installerPont() {
  const importerDiffere = vi.fn().mockImplementation(() =>
    Promise.resolve({ ok: true, data: { id: "x", mode: "livraison", nomFichier: "livraison.xlsx", statut: "EN_ATTENTE", message: null, resultat: null }, message: "Fichier mis de côté : il sera importé automatiquement au retour du réseau." }),
  );
  window.medconnecteDesktop = { version: "0.1.0", stock: { sortir: vi.fn(), importerDiffere } } as unknown as PontDesktop;
  return importerDiffere;
}

describe("Import Excel du stock hors ligne sur le poste", () => {
  it("montre le message hors ligne, sans modèle ni aperçu, et met le fichier de côté en base64", async () => {
    const importerDiffere = installerPont();
    const onSuccess = vi.fn();
    render(<ImportStockModal isOpen onClose={vi.fn()} onSuccess={onSuccess} structureId="s1" modesPermis={["livraison"]} horsLigne />);
    expect(screen.getByText(/Vous êtes hors ligne : le fichier sera importé automatiquement au retour du réseau, sans aperçu/)).toBeTruthy();
    expect(screen.queryByText("Télécharger le modèle Excel")).toBeNull();
    expect(screen.queryByRole("button", { name: "Vérifier le fichier" })).toBeNull();

    const bouton = screen.getByRole("button", { name: "Mettre le fichier de côté" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    const fichier = new File([new Uint8Array([80, 75, 3, 4])], "livraison.xlsx");
    // jsdom n'implémente pas File.arrayBuffer
    Object.defineProperty(fichier, "arrayBuffer", { value: () => Promise.resolve(new Uint8Array([80, 75, 3, 4]).buffer) });
    fireEvent.change(screen.getByLabelText(/Votre fichier Excel/), { target: { files: [fichier] } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Mettre le fichier de côté" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Mettre le fichier de côté" }));

    await waitFor(() => expect(importerDiffere).toHaveBeenCalledWith("s1", { id: expect.any(String), mode: "livraison", nomFichier: "livraison.xlsx", contenuBase64: "UEsDBA==" }));
    expect(await screen.findByText("Fichier mis de côté")).toBeTruthy();
    expect(screen.getByText(/importé automatiquement au retour du réseau/)).toBeTruthy();
  });

  it("refuse un fichier de plus de 1,4 Mo en le disant", async () => {
    installerPont();
    render(<ImportStockModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} structureId="s1" modesPermis={["livraison"]} horsLigne />);
    const gros = new File([new Uint8Array(1_400_001)], "gros.xlsx");
    fireEvent.change(screen.getByLabelText(/Votre fichier Excel/), { target: { files: [gros] } });
    expect((await screen.findByRole("alert")).textContent).toContain("1,4 Mo");
  });
});
