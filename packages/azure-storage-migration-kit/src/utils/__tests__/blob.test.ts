import { afterEach, describe, expect, it, vi } from "vitest";
import * as SB from "@azure/storage-blob";
import * as E from "fp-ts/lib/Either";
import { downloadToBuffer, exists, generateSasUrl } from "../blob";

const generateSasUrlMock = vi.fn();
const existsMock = vi.fn();
const downloadToBufferMock = vi.fn();
const blobClient = {
  downloadToBuffer: downloadToBufferMock,
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
