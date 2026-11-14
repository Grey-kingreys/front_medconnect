import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChoixLot } from "./ChoixLot";

afterEach(() => {
  cleanup();
});

const LOTS = [
  { id: "l1", numeroLot: "DL23K052", dateExpiration: "2026-10-01T00:00:00.000Z", quantite: 6 },
  { id: "l2", numeroLot: null, dateExpiration: null, quantite: 1 },
];

describe("ChoixLot", () => {
  it("affiche le libellé exact d'un lot périmé numéroté et d'un lot sans numéro ni date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T10:00:00.000Z"));
    render(<ChoixLot lots={LOTS} valeur={null} onChange={() => {}} legende="Lot à sortir" coefficient={20} unite="COMPRIME" />);
    vi.useRealTimers();

    expect(screen.getByRole("group", { name: "Lot à sortir" })).toBeInTheDocument();
    expect(screen.getByLabelText("Lot DL23K052, périmé le 01/10/2026, 6 comprimés")).toBeInTheDocument();
    expect(screen.getByLabelText("Lot sans numéro, sans date de péremption, 1 comprimé")).toBeInTheDocument();
  });

  it("appelle onChange avec l'identifiant du lot cliqué", () => {
    const onChange = vi.fn();
    render(<ChoixLot lots={LOTS} valeur="l1" onChange={onChange} legende="Lot à sortir" coefficient={20} unite="COMPRIME" />);

    fireEvent.click(screen.getByRole("radio", { name: /Lot sans numéro/ }));

    expect(onChange).toHaveBeenCalledWith("l2");
    expect(screen.getByRole("radio", { name: /DL23K052/ })).toBeChecked();
  });
});
