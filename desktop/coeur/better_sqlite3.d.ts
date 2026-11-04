// Déclaration minimale de better-sqlite3 13 (le paquet ne livre pas ses types).
// Seules les fonctions utilisées par stockage_sqlite.ts y figurent.
declare module "better-sqlite3" {
  interface Instruction {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  }

  interface BaseDeDonnees {
    prepare(sql: string): Instruction;
    exec(sql: string): unknown;
    transaction<T>(travail: () => T): () => T;
    close(): void;
  }

  interface ConstructeurBaseDeDonnees {
    new (chemin: string, options?: { readonly?: boolean }): BaseDeDonnees;
  }

  const Database: ConstructeurBaseDeDonnees;
  export default Database;
}
