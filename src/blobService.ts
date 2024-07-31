import { constant, pipe } from "fp-ts/lib/function";
import * as B from "fp-ts/boolean";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { BlobService, StorageError } from "azure-storage";
import { BlobNotFoundCode, BlobServiceWithFallBack } from "./types";

export const doesBlobExist = (
  blobServiceWithFallback: BlobServiceWithFallBack,
  containerName: string,
  blobName: string
): TE.TaskEither<Error, BlobService.BlobResult> =>
  pipe(
    TE.taskify<Error, BlobService.BlobResult>(cb =>
      blobServiceWithFallback.primary.doesBlobExist(containerName, blobName, cb)
    )(),
    TE.chain(primaryRes =>
      pipe(
        primaryRes.exists === true,
        B.fold(
          () =>
            pipe(
              blobServiceWithFallback.secondary,
              O.fromNullable,
              O.map(fallback =>
                TE.taskify<Error, BlobService.BlobResult>(cb =>
                  fallback.doesBlobExist(containerName, blobName, cb)
                )()
              ),
              O.getOrElse(() => TE.right(primaryRes))
            ),
          () => TE.right(primaryRes)
        )
      )
    )
  );

export const upsertBlobFromText = (
  blobService: BlobServiceWithFallBack,
  containerName: string,
  blobName: string,
  text: string | Buffer,
  options: BlobService.CreateBlobRequestOptions = {}
): TE.TaskEither<Error, O.Option<BlobService.BlobResult>> =>
  pipe(
    TE.taskify<Error, BlobService.BlobResult>(cb =>
      blobService.primary.createBlockBlobFromText(
        containerName,
        blobName,
        text,
        options,
        cb
      )
    )(),
    TE.map(O.fromNullable)
  );

export const getBlobAsText = (
  blobService: BlobServiceWithFallBack,
  containerName: string,
  blobName: string,
  options: BlobService.GetBlobRequestOptions = {}
): TE.TaskEither<Error, O.Option<string>> =>
  pipe(
    // eslint-disable-next-line sonarjs/cognitive-complexity
    new Promise<E.Either<Error, O.Option<string>>>(resolve => {
      blobService.primary.getBlobToText(
        containerName,
        blobName,
        options,
        (err, result, __) => {
          if (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorAsStorageError = err as StorageError;
            if (
              errorAsStorageError.code !== undefined &&
              errorAsStorageError.code === BlobNotFoundCode
            ) {
              return pipe(
                blobService.secondary,
                O.fromNullable,
                O.map(fallback =>
                  fallback.getBlobToText(
                    containerName,
                    blobName,
                    options,
                    (e, r, ___) => {
                      if (e) {
                        const storageError = e as StorageError;
                        if (
                          storageError.code !== undefined &&
                          storageError.code === BlobNotFoundCode
                        ) {
                          return resolve(
                            E.right<Error, O.Option<string>>(O.none)
                          );
                        } else {
                          return resolve(E.left<Error, O.Option<string>>(e));
                        }
                      } else {
                        return resolve(
                          E.right<Error, O.Option<string>>(O.fromNullable(r))
                        );
                      }
                    }
                  )
                ),
                O.getOrElse(() =>
                  resolve(E.right<Error, O.Option<string>>(O.none))
                )
              );
            }
            return resolve(E.left<Error, O.Option<string>>(err));
          } else {
            return resolve(
              E.right<Error, O.Option<string>>(O.fromNullable(result))
            );
          }
        }
      );
    }),
    promise => TE.tryCatch(() => promise, E.toError),
    TE.chain(TE.fromEither)
  );

export const getBlobAsTextWithError = (
  blobService: BlobServiceWithFallBack,
  containerName: string,
  options: BlobService.GetBlobRequestOptions = {}
) => (blobName: string): TE.TaskEither<StorageError, O.Option<string>> =>
  pipe(
    new Promise<E.Either<StorageError, O.Option<string>>>(resolve =>
      blobService.primary.getBlobToText(
        containerName,
        blobName,
        options,
        (err, result, _) =>
          err
            ? resolve(E.left(err))
            : pipe(
                result,
                O.fromNullable,
                O.map(res => resolve(E.right(O.fromNullable(res)))),
                O.getOrElse(() =>
                  pipe(
                    blobService.secondary,
                    O.fromNullable,
                    O.map(fallback =>
                      fallback.getBlobToText(
                        containerName,
                        blobName,
                        options,
                        (e, r, __) =>
                          e
                            ? resolve(E.left(e))
                            : resolve(E.right(O.fromNullable(r)))
                      )
                    ),
                    O.getOrElse(() => resolve(E.right(O.none)))
                  )
                )
              )
      )
    ),
    constant
  );
