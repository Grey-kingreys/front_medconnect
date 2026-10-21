import { describe, expect, it } from "vitest";
import { ApiError } from "./api_auth";

describe("ApiError", () => {
  it("expose le message, le statut et le nom", () => {
    const err = new ApiError("Acces refuse", 403);
    expect(err.message).toBe("Acces refuse");
    expect(err.status).toBe(403);
    expect(err.name).toBe("ApiError");
  });

  it("est une instance d'Error et d'ApiError", () => {
    const err = new ApiError("Erreur", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});
