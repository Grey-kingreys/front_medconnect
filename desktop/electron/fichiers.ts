// Fichiers réels pour `traiterBaseIllisible` : un renommage, jamais une suppression ni un écrasement.
import { existsSync, renameSync } from "node:fs";
import type { FichiersBase } from "../coeur/base_illisible";

export const fichiersReels: FichiersBase = {
  existe: (chemin) => existsSync(chemin),
  renommer(de, vers) {
    // Sous Windows, renameSync remplace une destination existante : on le refuse.
    if (existsSync(vers)) throw new Error("La destination existe déjà.");
    renameSync(de, vers);
  },
};
