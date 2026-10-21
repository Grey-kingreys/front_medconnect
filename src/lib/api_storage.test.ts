import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "./api_auth";
import { confirmUpload, deleteStoredFile, getReadUrl, presignUpload } from "./api_storage";

vi.mock("./api_auth");

const mockedAuthFetch = vi.mocked(authFetch);

beforeEach(() => {
  mockedAuthFetch.mockReset();
});

describe("api_storage", () => {
  it("presignUpload envoie la demande en POST sur /storage/presign", () => {
    const body = { filename: "a.pdf", contentType: "application/pdf", visibility: "private" as const };
    presignUpload(body);
    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/storage/presign");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual(body);
  });

  it("confirmUpload envoie { id } en POST sur /storage/confirm", () => {
    confirmUpload("f1");
    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/storage/confirm");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual({ id: "f1" });
  });

  it("getReadUrl interroge /storage/:id/read-url", () => {
    getReadUrl("f2");
    expect(mockedAuthFetch.mock.calls[0][0]).toBe("/storage/f2/read-url");
  });

  it("deleteStoredFile appelle DELETE sur /storage/:id", () => {
    deleteStoredFile("f3");
    const [endpoint, options] = mockedAuthFetch.mock.calls[0];
    expect(endpoint).toBe("/storage/f3");
    expect(options?.method).toBe("DELETE");
  });
});
