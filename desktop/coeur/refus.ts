/**
 * Refus métier du cœur : rien n'est écrit quand il est levé. Le message est lu par le
 * vendeur (non-développeur), il est donc repris du back à la lettre quand le code existe.
 */
export class RefusCaisse extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "RefusCaisse";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Le serveur exige un UUID (IsUUID('all')) pour la vente, la caisse, le comptage et le
 * mouvement : un autre identifiant ferait rejeter l'événement et perdre l'opération.
 */
export function exigerUuid(valeur: unknown, nom: string): void {
  if (typeof valeur !== "string" || !UUID.test(valeur)) {
    throw refusValidation(`L'identifiant ${nom} est invalide : il doit être généré par le poste (UUID).`);
  }
}

export function refusValidation(message: string): RefusCaisse {
  return new RefusCaisse(400, "VALIDATION", message);
}
