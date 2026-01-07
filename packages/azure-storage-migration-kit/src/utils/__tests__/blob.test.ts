import { afterEach, describe, expect, it, vi } from "vitest";
import * as SB from "@azure/storage-blob";
import * as E from "fp-ts/lib/Either";
import { download, downloadToBuffer, exists, generateSasUrl } from "../blob";

const generateSasUrlMock = vi.fn();
const existsMock = vi.fn();
const downloadToBufferMock = vi.fn();
const downloadMock = vi.fn();
const blobClient = {
  downloadToBuffer: downloadToBufferMock,
  download: downloadMock,
  exists: existsMock,
  generateSasUrl: generateSasUrlMock,
} as unknown as SB.BlobClient;

const aSasUrl = "SAS";

afterEach(() => {
  vi.resetAllMocks();
});

describe("downloadToBuffer", () => {
  it("should return a Blob Buffer", async () => {
    downloadToBufferMock.mockImplementationOnce(() =>
      Promise.resolve(Buffer.from(aSasUrl))
    );
    const res = await downloadToBuffer(blobClient)();
    if (E.isRight(res)) {
      expect(res.right).toEqual(Buffer.from(aSasUrl));
    }
  });

  it("should return an error if something goes wrong while downloading Buffer", async () => {
    downloadToBufferMock.mockImplementationOnce(() =>
      Promise.reject("Cannot download blob's buffer")
    );
    const res = await downloadToBuffer(blobClient)();
    if (E.isLeft(res)) {
      expect(res.left).toEqual(Error("Cannot download blob's buffer"));
    }
  });
});

describe("download", () => {
  it("should return a Blob Download Response Parsed", async () => {
    const mockResponse: SB.BlobDownloadResponseParsed = {
      _response: {} as SB.HttpResponse & {
        parsedHeaders: SB.BlobDownloadHeaders;
      },
      readableStreamBody: Buffer.from(
        aSasUrl
      ) as unknown as NodeJS.ReadableStream,
    };
    const downloadMock = vi.fn().mockResolvedValue(mockResponse);
    const mockBlobClient = {
      download: downloadMock,
    } as unknown as SB.BlobClient;

    const res = await download(mockBlobClient)();
    expect(res).toMatchObject(E.right(mockResponse));
  });

  it("should return an error if something goes wrong while downloading", async () => {
    const errorMessage = "Cannot download blob's content";
    const downloadMock = vi.fn().mockRejectedValue(errorMessage);
    const mockBlobClient = {
      download: downloadMock,
    } as unknown as SB.BlobClient;

    const res = await download(mockBlobClient)();
    expect(res).toMatchObject(E.left(Error(errorMessage)));
  });
});

describe("generateSasUrl", () => {
  it("should return a SAS string", async () => {
    generateSasUrlMock.mockImplementationOnce(() => Promise.resolve(aSasUrl));
    const res = await generateSasUrl(blobClient)();
    if (E.isRight(res)) {
      expect(res.right).toEqual(aSasUrl);
    }
  });

  it("should return an error if something goes wrong while generating SAS", async () => {
    generateSasUrlMock.mockImplementationOnce(() =>
      Promise.reject("Cannot generate SAS")
    );
    const res = await generateSasUrl(blobClient)();
    if (E.isLeft(res)) {
      expect(res.left).toEqual(Error("Cannot generate SAS"));
    }
  });
});

describe("exists", () => {
  it("should return a boolean indicating if a blob exists or not", async () => {
    existsMock.mockImplementationOnce(() => Promise.resolve(true));
    const res = await exists(blobClient)();
    if (E.isRight(res)) {
      expect(res.right).toEqual(true);
    }
  });

  it("should return an error if something goes wrong", async () => {
    existsMock.mockImplementationOnce(() =>
      Promise.reject("Cannot check blob exist")
    );
    const res = await exists(blobClient)();
    if (E.isLeft(res)) {
      expect(res.left).toEqual(Error("Cannot check blob exist"));
    }
  });
});
