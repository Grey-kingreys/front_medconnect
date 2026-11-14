/**
 * Accès à la base locale, derrière une interface : le cœur n'importe jamais
 * better-sqlite3 (seul stockage_sqlite.ts le fait).
 */
export interface Stockage {
  /** Exécute une instruction ; sans paramètres, plusieurs instructions séparées par des points-virgules sont permises. */
  executer(sql: string, params?: unknown[]): void;
  lire<T>(sql: string, params?: unknown[]): T[];
  lireUn<T>(sql: string, params?: unknown[]): T | undefined;
  /** Tout ou rien : une exception annule le travail. Les appels imbriqués sont permis. */
  transaction<T>(travail: () => T): T;
  fermer(): void;
}
