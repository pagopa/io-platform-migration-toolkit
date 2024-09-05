import { afterEach, describe, expect, it, vi } from "vitest";
import * as SB from "@azure/storage-blob";
import { BlobClientWithFallback } from "../blob";

const primaryGenerateSasUrlMock = vi.fn();
const primaryExistsMock = vi.fn();
const primaryDownloadToBufferMock = vi.fn();
const primaryDeleteIfExistsMock = vi.fn();
const primaryBlobClient = {
  deleteIfExists: primaryDeleteIfExistsMock,
  downloadToBuffer: primaryDownloadToBufferMock,
  exists: primaryExistsMock,
  generateSasUrl: primaryGenerateSasUrlMock,
} as unknown as SB.BlobClient;

const fallbackGenerateSasUrlMock = vi.fn();
const fallbackExistsMock = vi.fn();
const fallbackDownloadToBufferMock = vi.fn();
const fallbackDeleteIfExistsMock = vi.fn();
const fallbackBlobClient = {
  deleteIfExists: fallbackDeleteIfExistsMock,
  downloadToBuffer: fallbackDownloadToBufferMock,
  exists: fallbackExistsMock,
  generateSasUrl: fallbackGenerateSasUrlMock,
} as unknown as SB.BlobClient;

const getBlobClientWithFallback = () =>
  new BlobClientWithFallback(primaryBlobClient, fallbackBlobClient);

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
