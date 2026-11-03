import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Coupure, LigneComptage } from "@/lib/api_caisse";
import { ComptageCoupures } from "./ComptageCoupures";
import { lignesDepuisReferentiel } from "./comptage";

const COUPURES: Coupure[] = [
  { devise: "GNF", valeurFaciale: 20000, type: "BILLET", ordre: 1 },
  { devise: "GNF", valeurFaciale: 10000, type: "BILLET", ordre: 2 },
  { devise: "GNF", valeurFaciale: 500, type: "BILLET", ordre: 3 },
];

function Banc({ onTermine = () => {}, suivi }: { onTermine?: () => void; suivi?: (l: LigneComptage[]) => void }) {
  const [lignes, setLignes] = useState(lignesDepuisReferentiel(COUPURES));
  return (
    <ComptageCoupures
      coupures={COUPURES}
      valeur={lignes}
      onChange={(l) => {
        setLignes(l);
        suivi?.(l);
      }}
      onTermine={onTermine}
      legende="Fond de caisse"
    />
  );
}

afterEach(cleanup);

describe("ComptageCoupures", () => {
  it("passe à la coupure suivante avec Entrée et termine au dernier champ", () => {
    const onTermine = vi.fn();
    render(<Banc onTermine={onTermine} />);
    const [premier, deuxieme, dernier] = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(document.activeElement).toBe(premier);
    fireEvent.keyDown(premier, { key: "Enter" });
    expect(document.activeElement).toBe(deuxieme);
    fireEvent.keyDown(deuxieme, { key: "Enter" });
    expect(onTermine).not.toHaveBeenCalled();
    fireEvent.keyDown(dernier, { key: "Enter" });
    expect(onTermine).toHaveBeenCalledTimes(1);
  });

  it("affiche le total en direct", () => {
    render(<Banc />);
    const [a, b, c] = screen.getAllByRole("textbox");
    fireEvent.change(a, { target: { value: "2" } });
    fireEvent.change(b, { target: { value: "1" } });
    fireEvent.change(c, { target: { value: "11" } });
    expect(screen.getByText(/Total compté : 55\s500 GNF/)).toBeTruthy();
  });

  it("ignore les lettres saisies", () => {
    const suivi = vi.fn();
    render(<Banc suivi={suivi} />);
    const [premier] = screen.getAllByRole("textbox");
    fireEvent.change(premier, { target: { value: "ab" } });
    expect(suivi).toHaveBeenLastCalledWith(expect.arrayContaining([{ valeurFaciale: 20000, nombre: 0 }]));
    fireEvent.change(premier, { target: { value: "1x2" } });
    expect(suivi).toHaveBeenLastCalledWith(expect.arrayContaining([{ valeurFaciale: 20000, nombre: 12 }]));
  });
});
