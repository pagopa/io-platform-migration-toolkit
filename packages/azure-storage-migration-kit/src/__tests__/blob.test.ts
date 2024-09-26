/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlobClientWithFallback, BlockBlobClientWithFallback } from "../blob";

const primaryGenerateSasUrlMock = vi.fn();
const primaryExistsMock = vi.fn();
const primaryDownloadToBufferMock = vi.fn();
const primaryDeleteIfExistsMock = vi.fn();
const uploadMock = vi.fn();
const primaryBlobClient = {
  deleteIfExists: primaryDeleteIfExistsMock,
  downloadToBuffer: primaryDownloadToBufferMock,
  exists: primaryExistsMock,
  generateSasUrl: primaryGenerateSasUrlMock,
  upload: uploadMock,
} as any;

const fallbackGenerateSasUrlMock = vi.fn();
const fallbackExistsMock = vi.fn();
const fallbackDownloadToBufferMock = vi.fn();
const fallbackDeleteIfExistsMock = vi.fn();
const fallbackBlobClient = {
  deleteIfExists: fallbackDeleteIfExistsMock,
  downloadToBuffer: fallbackDownloadToBufferMock,
  exists: fallbackExistsMock,
  generateSasUrl: fallbackGenerateSasUrlMock,
} as any;

const getBlobClientWithFallback = () =>
  new BlobClientWithFallback(primaryBlobClient, fallbackBlobClient);

const getBlockBlobClientWithFallback = () =>
  new BlockBlobClientWithFallback(primaryBlobClient, fallbackBlobClient);

afterEach(() => {
  vi.resetAllMocks();
});

describe("exists", () => {
  it("should return true if blob exists on primary storage", async () => {
    primaryExistsMock.mockImplementationOnce(() => Promise.resolve(true));
    const exists = await getBlobClientWithFallback().exists();
    expect(exists).toBeTruthy();
    expect(primaryBlobClient.exists).toHaveBeenCalled();
    expect(fallbackBlobClient.exists).not.toHaveBeenCalled();
  });

  it("should return true if blob exists on fallback storage", async () => {
    primaryExistsMock.mockImplementationOnce(() => Promise.resolve(false));
    fallbackExistsMock.mockImplementationOnce(() => Promise.resolve(true));
    const exists = await getBlobClientWithFallback().exists();
    expect(exists).toBeTruthy();
    expect(primaryBlobClient.exists).toHaveBeenCalled();
    expect(fallbackBlobClient.exists).toHaveBeenCalled();
  });

  it("should return false if blob does not exists on either storages", async () => {
    primaryExistsMock.mockImplementationOnce(() => Promise.resolve(false));
    fallbackExistsMock.mockImplementationOnce(() => Promise.resolve(false));
    const exists = await getBlobClientWithFallback().exists();
    expect(exists).toBeFalsy();
    expect(primaryBlobClient.exists).toHaveBeenCalled();
    expect(fallbackBlobClient.exists).toHaveBeenCalled();
  });

  it("should return an error if something goes wrong while checking if blob exists", async () => {
    primaryExistsMock.mockImplementationOnce(() =>
      Promise.reject("Cannot check existing")
    );
    getBlobClientWithFallback()
      .exists()
      .then()
      .catch((err) => expect(err).toBeDefined());
  });
});

describe("generateSASUrl", () => {
  it("should return SAS Url if blob exists on primary storage", async () => {
    primaryExistsMock.mockImplementationOnce(() => Promise.resolve(true));
    primaryGenerateSasUrlMock.mockImplementationOnce(() =>
      Promise.resolve("SASUrl")
    );
    const sasUrl = await getBlobClientWithFallback().generateSasUrl({});
    expect(sasUrl).toBeDefined();
    expect(primaryBlobClient.exists).toHaveBeenCalled();
    expect(primaryBlobClient.generateSasUrl).toHaveBeenCalled();
  });

  it("should return SAS Url if blob exists on fallback storage", async () => {
    primaryExistsMock.mockImplementationOnce(() => Promise.resolve(false));
    fallbackExistsMock.mockImplementationOnce(() => Promise.resolve(true));
    fallbackGenerateSasUrlMock.mockImplementationOnce(() =>
      Promise.resolve("SASUrl")
    );
    const sasUrl = await getBlobClientWithFallback().generateSasUrl({});
    expect(sasUrl).toBeDefined();
    expect(primaryBlobClient.exists).toHaveBeenCalled();
    expect(primaryBlobClient.generateSasUrl).not.toHaveBeenCalled();
    expect(fallbackBlobClient.generateSasUrl).toHaveBeenCalled();
  });

  it("should return an error if something goes wrong while generating SAS Url", async () => {
    primaryExistsMock.mockImplementationOnce(() => () => Promise.resolve(true));
    primaryGenerateSasUrlMock.mockImplementationOnce(() =>
      Promise.reject("Cannot generate SASUrl")
    );
    getBlobClientWithFallback()
      .generateSasUrl({})
      .then()
      .catch((err) => expect(err).toBeDefined());
  });
});

describe("deleteIfExists", () => {
  it("should delete a blob existing on primary storage", async () => {
    primaryDeleteIfExistsMock.mockImplementationOnce(() =>
      Promise.resolve({
        succeeded: true,
      })
    );
    fallbackDeleteIfExistsMock.mockImplementationOnce(() =>
      Promise.resolve({
        succeeded: false,
      })
    );
    const result = await getBlobClientWithFallback().deleteIfExists({});
    expect(result).toBeDefined();
    expect(result.succeeded).toBeTruthy();
    expect(primaryBlobClient.deleteIfExists).toHaveBeenCalled();
    expect(fallbackBlobClient.deleteIfExists).toHaveBeenCalled();
  });

  it("should delete a blob existing on fallback storage", async () => {
    primaryDeleteIfExistsMock.mockResolvedValue({
      succeeded: false,
    });
    fallbackDeleteIfExistsMock.mockResolvedValue({
      succeeded: true,
    });
    const result = await getBlobClientWithFallback().deleteIfExists({});
    expect(result).toBeDefined();
    expect(result.succeeded).toBeTruthy();
    expect(primaryBlobClient.deleteIfExists).toHaveBeenCalled();
    expect(fallbackBlobClient.deleteIfExists).toHaveBeenCalled();
  });

  it("should return an error if something goes wrong while deleting a blob", async () => {
    primaryDeleteIfExistsMock.mockImplementationOnce(() =>
      Promise.reject("Cannot delete blob")
    );
    getBlobClientWithFallback()
      .deleteIfExists({})
      .then()
      .catch((err) => expect(err).toBeDefined());
  });
});

describe("downloadToBuffer", () => {
  it("should download a blob existing on primary storage", async () => {
    primaryExistsMock.mockResolvedValueOnce(true);
    primaryDownloadToBufferMock.mockResolvedValueOnce(Buffer.from("Blob"));
    const result = await getBlobClientWithFallback().downloadToBuffer();
    expect(result).toBeDefined();
    expect(primaryBlobClient.exists).toHaveBeenCalled();
    expect(primaryBlobClient.downloadToBuffer).toHaveBeenCalled();
    expect(fallbackBlobClient.exists).not.toHaveBeenCalled();
    expect(fallbackBlobClient.downloadToBuffer).not.toHaveBeenCalled();
  });

  it("should download a blob existing on fallback storage", async () => {
    primaryExistsMock.mockResolvedValueOnce(false);
    fallbackDownloadToBufferMock.mockResolvedValue(Buffer.from("Blob"));
    const result = await getBlobClientWithFallback().downloadToBuffer();
    expect(result).toBeDefined();
    expect(primaryBlobClient.exists).toHaveBeenCalled();
    expect(primaryBlobClient.downloadToBuffer).not.toHaveBeenCalled();
    expect(fallbackBlobClient.downloadToBuffer).toHaveBeenCalled();
  });

  it("should return an error if something goes wrong while downloading a blob", async () => {
    primaryExistsMock.mockResolvedValueOnce(true);
    primaryDownloadToBufferMock.mockRejectedValueOnce("Cannot download blob");
    getBlobClientWithFallback()
      .deleteIfExists({})
      .then()
      .catch((err) => expect(err).toBeDefined());
  });
});

describe("upload", () => {
  it("should upload a blob on primary storage", async () => {
    uploadMock.mockResolvedValueOnce({});
    const content = Buffer.from("Blob");
    const result = await getBlockBlobClientWithFallback().upload(
      content,
      content.length
    );
    expect(result).toBeDefined();
    expect(primaryBlobClient.upload).toHaveBeenCalled();
  });

  it("should return an error if something goes wrong while uploading a blob", async () => {
    uploadMock.mockRejectedValueOnce("Cannot upload blob");
    const content = Buffer.from("Blob");
    getBlockBlobClientWithFallback()
      .upload(content, content.length)
      .then()
      .catch((err) => expect(err).toBeDefined());
  });
});
