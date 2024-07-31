import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as AS from "azure-storage";
import { BlobServiceWithFallBack } from "./types";

/**
 *
 * @param primaryConnectionString: The primary storage used for principal read/write IO
 * @param secondaryConnectionString: Optional: The fallback storage used for migration purpose (i.e: read fallback)
 * @returns Both primary and secondary blob services while needed.
 */
export const createBlobService = (
  primaryConnectionString: string,
  secondaryConnectionString?: string
): BlobServiceWithFallBack =>
  pipe(
    secondaryConnectionString,
    O.fromNullable,
    O.map(conn => ({
      secondary: AS.createBlobService(conn)
    })),
    O.getOrElseW(() => ({})),
    secondaryConfig => ({
      primary: AS.createBlobService(primaryConnectionString),
      ...secondaryConfig
    })
  );
