import { access } from "node:fs/promises";

import { AkpError } from "../core/errors/akp-error.js";

export async function ensureStoreBuilt(databasePath: string): Promise<void> {
  try {
    await access(databasePath);
  } catch {
    throw new AkpError(
      "AKP_STORE_NOT_BUILT",
      "Local AKP store is not built. Run `akp build` first.",
      {
        database_path: databasePath,
      },
    );
  }
}
