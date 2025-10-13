import { afterEach, describe, expect, it, vi } from "vitest";
import * as AS from "azure-storage";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import {
  doesBlobExist,
  getBlobAsText,
  getBlobAsTextOnDifferentContainerNames,
  upsertBlobFromText,
} from "../blobService";
import { BlobNotFoundCode } from "../types";

const doesBlobExistsMock = vi.fn();
const createBlockBlobFromTextMock = vi.fn();
const getBlobToTextMock = vi.fn();
const blobServiceMock = {
  doesBlobExist: doesBlobExistsMock,
  createBlockBlobFromText: createBlockBlobFromTextMock,
  getBlobToText: getBlobToTextMock,
} as unknown as AS.BlobService;

const doesBlobExistsSecondaryMock = vi.fn();
const createBlockBlobFromTextSecondaryMock = vi.fn();
const getBlobToTextSecondaryMock = vi.fn();
const blobServiceSecondaryMock = {
  doesBlobExist: doesBlobExistsSecondaryMock,
  createBlockBlobFromText: createBlockBlobFromTextSecondaryMock,
  getBlobToText: getBlobToTextSecondaryMock,
} as unknown as AS.BlobService;

const blobServiceWithFallbackOnlyPrimary = {
  primary: blobServiceMock,
};

const blobServiceWithFallback = {
  primary: blobServiceMock,
  secondary: blobServiceSecondaryMock,
};

const TimeOutError = "Connection Timed Out";
const trackerFnMock = vi.fn().mockImplementation((containerName, blobName) =>
  // eslint-disable-next-line no-console
  console.log(`Fallback blobName ${blobName} in container ${containerName}`)
);

afterEach(() => {
  vi.resetAllMocks();
});
describe("doesBlobExists", () => {
  it("should return an error if primary blobService raise an error", async () => {
    doesBlobExistsMock.mockImplementationOnce((_, __, cb) =>
      cb(Error(TimeOutError), undefined)
    );
    const res = await doesBlobExist(
      blobServiceWithFallbackOnlyPrimary,
      "",
      ""
    )();
    expect(E.isLeft(res)).toBeTruthy();
    pipe(
      res,
      E.mapLeft((error) =>
        expect(error.message).toEqual(expect.stringContaining(TimeOutError))
      )
    );
  });

  it("should return an error if either primary and secondary blobService raise an error", async () => {
    doesBlobExistsMock.mockImplementationOnce((_, __, cb) =>
      cb(Error(TimeOutError), undefined)
    );
    doesBlobExistsSecondaryMock.mockImplementationOnce((_, __, f) =>
      f(Error(TimeOutError), undefined)
    );
    const res = await doesBlobExist(blobServiceWithFallback, "", "")();
    expect(E.isLeft(res)).toBeTruthy();
    pipe(
      res,
      E.mapLeft((secError) =>
        expect(secError.message).toEqual(
          expect.stringContaining("Connection Timed Out")
        )
      )
    );
  });
  it("should return primary blobService BlobReturn", async () => {
    doesBlobExistsMock.mockImplementationOnce((_, __, cb) =>
      cb(undefined, {
        exists: true,
      })
    );
    const res = await doesBlobExist(
      blobServiceWithFallbackOnlyPrimary,
      "",
      "",
      trackerFnMock
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((blobResult) => {
        expect(blobResult).toEqual({
          exists: true,
        });
        expect(trackerFnMock).not.toHaveBeenCalled();
      })
    );
  });

  it("should return secondary blobService result if primary does not exists", async () => {
    doesBlobExistsMock.mockImplementationOnce((_, __, cb) =>
      cb(undefined, {
        exists: false,
      })
    );
    doesBlobExistsSecondaryMock.mockImplementationOnce((_, __, f) =>
      f(undefined, {
        exists: true,
      })
    );
    const res = await doesBlobExist(
      blobServiceWithFallback,
      "cont",
      "blob",
      trackerFnMock
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((secondaryBlobResult) => {
        expect(secondaryBlobResult).toEqual({
          exists: true,
        });
        expect(trackerFnMock).toHaveBeenCalled();
        expect(trackerFnMock).toHaveBeenCalledWith("cont", "blob");
      })
    );
  });

  it("should call secondary blobService with secondaryContainerName", async () => {
    doesBlobExistsMock.mockImplementationOnce((_, __, cb) =>
      cb(undefined, {
        exists: false,
      })
    );
    doesBlobExistsSecondaryMock.mockImplementationOnce((_, __, f) =>
      f(undefined, {
        exists: true,
      })
    );
    const res = await doesBlobExist(
      blobServiceWithFallback,
      "cont",
      "blob",
      trackerFnMock,
      "secondaryContainer"
    )();
    expect(E.isRight(res)).toBeTruthy();

    expect(doesBlobExistsMock).toHaveBeenCalled();
    expect(doesBlobExistsMock).toHaveBeenCalledWith(
      "cont",
      "blob",
      expect.any(Function)
    );

    expect(doesBlobExistsSecondaryMock).toHaveBeenCalled();
    expect(doesBlobExistsSecondaryMock).toHaveBeenCalledWith(
      "secondaryContainer",
      "blob",
      expect.any(Function)
    );

    expect(trackerFnMock).toHaveBeenCalled();
    expect(trackerFnMock).toHaveBeenCalledWith("secondaryContainer", "blob");
  });
});

describe("doesBlobExistsOnDifferentContainerNames", () => {
  it("should call doesBlobExists with two container names", async () => {
    doesBlobExistsMock.mockImplementationOnce((_, __, cb) =>
      cb(undefined, {
        exists: false,
      })
    );
    doesBlobExistsSecondaryMock.mockImplementationOnce((_, __, f) =>
      f(undefined, {
        exists: true,
      })
    );
    const res = await doesBlobExist(
      blobServiceWithFallback,
      "cont",
      "blob",
      trackerFnMock,
      "secondaryContainer"
    )();
    expect(E.isRight(res)).toBeTruthy();

    expect(doesBlobExistsMock).toHaveBeenCalled();
    expect(doesBlobExistsMock).toHaveBeenCalledWith(
      "cont",
      "blob",
      expect.any(Function)
    );

    expect(doesBlobExistsSecondaryMock).toHaveBeenCalled();
    expect(doesBlobExistsSecondaryMock).toHaveBeenCalledWith(
      "secondaryContainer",
      "blob",
      expect.any(Function)
    );

    expect(trackerFnMock).toHaveBeenCalled();
    expect(trackerFnMock).toHaveBeenCalledWith("secondaryContainer", "blob");
  });
});

describe("upsertBlobFromText", () => {
  it("should return an error if blob upsert fails", async () => {
    createBlockBlobFromTextMock.mockImplementationOnce((_, __, ___, ____, cb) =>
      cb(Error("Error on upsert"), undefined)
    );
    const res = await upsertBlobFromText(
      blobServiceWithFallback,
      "",
      "",
      "text"
    )();
    expect(E.isLeft(res)).toBeTruthy();
    expect(createBlockBlobFromTextSecondaryMock).not.toHaveBeenCalled();
  });

  it("should return none if blobresult is undefined", async () => {
    createBlockBlobFromTextMock.mockImplementationOnce((_, __, ___, ____, cb) =>
      cb(undefined, undefined)
    );
    const res = await upsertBlobFromText(
      blobServiceWithFallback,
      "",
      "",
      "text"
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((res) => {
        expect(res).toBe(O.none);
        expect(createBlockBlobFromTextSecondaryMock).not.toHaveBeenCalled();
      })
    );
  });

  it("should upsert blob from text only on primary blobService", async () => {
    createBlockBlobFromTextMock.mockImplementationOnce((_, __, ___, ____, cb) =>
      cb(undefined, { created: true })
    );
    const res = await upsertBlobFromText(
      blobServiceWithFallback,
      "",
      "",
      "text"
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((res) => {
        expect(res).toEqual(
          O.some({
            created: true,
          })
        );
        expect(createBlockBlobFromTextSecondaryMock).not.toHaveBeenCalled();
      })
    );
  });
});

describe("getBlobAsText", () => {
  it("should return an error if getBlobToText fails on the primary blob service", async () => {
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(Error("Error while getting blob"), undefined)
    );
    const res = await getBlobAsText(blobServiceWithFallback, "", "")();
    expect(E.isLeft(res)).toBeTruthy();
    expect(getBlobToTextSecondaryMock).not.toHaveBeenCalled();
  });

  it("should return none if blob cannot be found", async () => {
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, undefined)
    );
    const res = await getBlobAsText(
      blobServiceWithFallbackOnlyPrimary,
      "",
      ""
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((res) => {
        expect(res).toBe(O.none);
        expect(getBlobToTextSecondaryMock).not.toHaveBeenCalled();
      })
    );
  });

  it("should return none if getBlobToText raise a not found error on primary without a fallback storage", async () => {
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(
        {
          code: BlobNotFoundCode,
        },
        undefined
      )
    );
    const res = await getBlobAsText(
      blobServiceWithFallbackOnlyPrimary,
      "",
      "",
      {},
      trackerFnMock
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((res) => {
        expect(res).toBe(O.none);
        expect(getBlobToTextSecondaryMock).not.toHaveBeenCalled();
        expect(trackerFnMock).not.toHaveBeenCalled();
      })
    );
  });

  it("should return secondary blob result if getBlobToText raise a not found error on primary", async () => {
    // eslint-disable-next-line sonarjs/no-identical-functions
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(
        {
          code: BlobNotFoundCode,
        },
        undefined
      )
    );
    getBlobToTextSecondaryMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, "blobContent")
    );
    const res = await getBlobAsText(
      blobServiceWithFallback,
      "",
      "",
      {},
      trackerFnMock
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((res) => {
        expect(res).toEqual(O.some("blobContent"));
        expect(getBlobToTextSecondaryMock).toHaveBeenCalled();
        expect(trackerFnMock).toHaveBeenCalled();
      })
    );
  });

  it("should return secondary blob result if first blob result is none on primary", async () => {
    // eslint-disable-next-line sonarjs/no-identical-functions
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, undefined)
    );
    getBlobToTextSecondaryMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, "blobContent")
    );
    const res = await getBlobAsText(
      blobServiceWithFallback,
      "",
      "",
      {},
      trackerFnMock
    )();
    expect(E.isRight(res)).toBeTruthy();
    pipe(
      res,
      E.map((res) => {
        expect(res).toEqual(O.some("blobContent"));
        expect(getBlobToTextSecondaryMock).toHaveBeenCalled();
        expect(trackerFnMock).toHaveBeenCalled();
        expect(trackerFnMock).toHaveBeenCalledWith("", "");
      })
    );
  });

  it("should call secondary blob service with secondaryContainerName", async () => {
    // eslint-disable-next-line sonarjs/no-identical-functions
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, undefined)
    );
    getBlobToTextSecondaryMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, "blobContent")
    );
    const res = await getBlobAsText(
      blobServiceWithFallback,
      "cont",
      "blob",
      {},
      trackerFnMock,
      "secondaryContainer"
    )();
    expect(E.isRight(res)).toBeTruthy();

    expect(getBlobToTextMock).toHaveBeenCalled();
    expect(getBlobToTextMock).toHaveBeenCalledWith(
      "cont",
      "blob",
      {},
      expect.any(Function)
    );

    expect(getBlobToTextSecondaryMock).toHaveBeenCalled();
    expect(getBlobToTextSecondaryMock).toHaveBeenCalledWith(
      "secondaryContainer",
      "blob",
      {},
      expect.any(Function)
    );

    expect(trackerFnMock).toHaveBeenCalled();
    expect(trackerFnMock).toHaveBeenCalledWith("secondaryContainer", "blob");
  });
});

describe("getBlobAsTextOnDifferentContainerNames", () => {
  // eslint-disable-next-line sonarjs/no-identical-functions
  it("should call getBlobAsText with two container names", async () => {
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, undefined)
    );
    getBlobToTextSecondaryMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, "blobContent")
    );
    const res = await getBlobAsTextOnDifferentContainerNames(
      blobServiceWithFallback,
      "primaryContainer",
      "secondaryContainer",
      "blobName",
      {},
      trackerFnMock
    )();
    expect(E.isRight(res)).toBeTruthy();

    expect(getBlobToTextMock).toHaveBeenCalled();
    expect(getBlobToTextMock).toHaveBeenCalledWith(
      "primaryContainer",
      "blobName",
      {},
      expect.any(Function)
    );

    expect(getBlobToTextSecondaryMock).toHaveBeenCalled();
    expect(getBlobToTextSecondaryMock).toHaveBeenCalledWith(
      "secondaryContainer",
      "blobName",
      {},
      expect.any(Function)
    );

    expect(trackerFnMock).toHaveBeenCalled();
    expect(trackerFnMock).toHaveBeenCalledWith(
      "secondaryContainer",
      "blobName"
    );
  });
});

describe("getBlobAsTextsWithErrorOnDifferentContainerName", () => {
  it("should call getBlobAsTextWithError with two container names", async () => {
    getBlobToTextMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, undefined)
    );
    getBlobToTextSecondaryMock.mockImplementationOnce((_, __, ___, cb) =>
      cb(undefined, "blobContent")
    );
    const res = await getBlobAsTextOnDifferentContainerNames(
      blobServiceWithFallback,
      "primaryContainer",
      "secondaryContainer",
      "blobName",
      {},
      trackerFnMock
    )();
    expect(E.isRight(res)).toBeTruthy();

    expect(getBlobToTextMock).toHaveBeenCalled();
    expect(getBlobToTextMock).toHaveBeenCalledWith(
      "primaryContainer",
      "blobName",
      {},
      expect.any(Function)
    );

    expect(getBlobToTextSecondaryMock).toHaveBeenCalled();
    expect(getBlobToTextSecondaryMock).toHaveBeenCalledWith(
      "secondaryContainer",
      "blobName",
      {},
      expect.any(Function)
    );

    expect(trackerFnMock).toHaveBeenCalled();
    expect(trackerFnMock).toHaveBeenCalledWith(
      "secondaryContainer",
      "blobName"
    );
  });
});
