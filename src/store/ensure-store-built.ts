import { access } from "node:fs/promises";

import { AppError } from "../core/errors/app-error.js";

export async function ensureStoreBuilt(databasePath: string): Promise<void> {
  try {
    await access(databasePath);
  } catch {
    throw new AppError(
      "AKP_STORE_NOT_BUILT",
      "Local AKP store is not built. Run `akp build` first.",
      {
        database_path: databasePath,
      },
    );
  }
}
