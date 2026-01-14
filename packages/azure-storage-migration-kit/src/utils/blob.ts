import * as SB from "@azure/storage-blob";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";

export const generateSasUrl = (
  client: SB.BlobClient | SB.BlockBlobClient,
  options: SB.BlobGenerateSasUrlOptions = {}
): TE.TaskEither<Error, string> =>
  TE.tryCatch(() => client.generateSasUrl(options), E.toError);

export const exists = (
  client: SB.BlobClient | SB.BlockBlobClient
): TE.TaskEither<Error, boolean> =>
  TE.tryCatch(() => client.exists(), E.toError);

export const downloadToBuffer = (
  client: SB.BlobClient | SB.BlockBlobClient,
  offset?: number,
  count?: number,
  options?: SB.BlobDownloadToBufferOptions
): TE.TaskEither<Error, Buffer> =>
  TE.tryCatch(() => client.downloadToBuffer(offset, count, options), E.toError);

export const download = (
  client: SB.BlobClient | SB.BlockBlobClient,
  offset?: number,
  count?: number,
  options?: SB.BlobDownloadOptions
): TE.TaskEither<Error, SB.BlobDownloadResponseParsed> =>
  TE.tryCatch(() => client.download(offset, count, options), E.toError);
