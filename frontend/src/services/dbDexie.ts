// src/services/dbDexie.ts
import Dexie, { type Table } from 'dexie';
import type { AnexoMeta } from './anexos';

/** Registro completo armazenado no IndexedDB */
export interface AnexoRecord {
  meta: AnexoMeta;
  blob: Blob;
}

/**
 * Classe Dexie que representa o banco de anexos.
 * Nome: "axos-anexos" (mesmo nome usado anteriormente).
 * Store "anexos" usa a chave meta.id e possui índice secundário por laudoId.
 */
export class AnexoDB extends Dexie {
  /** Store tipada */
  anexos!: Table<AnexoRecord, string>;

  constructor() {
    super('axos-anexos');
    this.version(1).stores({
      // keyPath = meta.id ; índice secundário por laudoId
      anexos: 'meta.id, meta.laudoId',
    });
  }
}

/** Instância única a ser importada pelos serviços */
export const db = new AnexoDB();
