// Coffre réel : Electron safeStorage. À utiliser une fois l'application prête (`app.whenReady`).
import { safeStorage } from "electron";
import type { Coffre } from "./cle_base";

export const coffreElectron: Coffre = {
  disponible() {
    if (!safeStorage.isEncryptionAvailable()) return false;
    // Sous Linux, « basic_text » veut dire sans vraie protection : refusé comme le reste.
    const choisi = (safeStorage as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend;
    return !(typeof choisi === "function" && choisi.call(safeStorage) === "basic_text");
  },
  chiffrer: (clair) => safeStorage.encryptString(clair),
  dechiffrer: (chiffre) => safeStorage.decryptString(chiffre),
};
