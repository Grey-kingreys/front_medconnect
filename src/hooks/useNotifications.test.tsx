import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "@/components/NotificationBell";
import { NotificationsProvider, useNotifications } from "./useNotifications";

const { getNotifications, markAllAsRead, markNotificationAsRead, deleteNotification, clearReadNotifications } =
  vi.hoisted(() => ({
    getNotifications: vi.fn(),
    markAllAsRead: vi.fn(),
    markNotificationAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    clearReadNotifications: vi.fn(),
  }));

vi.mock("@/lib/api_notifications", () => ({
  getNotifications,
  markAllAsRead,
  markNotificationAsRead,
  deleteNotification,
  clearReadNotifications,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

let etatVisibilite: "visible" | "hidden" = "visible";

const changerVisibilite = (etat: "visible" | "hidden") => {
  etatVisibilite = etat;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

const avancer = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const deuxCloches = () =>
  render(
    <NotificationsProvider>
      <NotificationBell />
      <NotificationBell />
    </NotificationsProvider>,
  );

beforeEach(() => {
  etatVisibilite = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => etatVisibilite });
  vi.clearAllMocks();
  getNotifications.mockResolvedValue({
    success: true,
    message: "",
    data: {
      notifications: [
        {
          id: "n1",
          type: "SYSTEME",
          titre: "Titre",
          message: "Message",
          lu: false,
          createdAt: "2026-10-21T00:00:00.000Z",
        },
      ],
      nonLues: 3,
    },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("NotificationsProvider, sondage partagé", () => {
  it("fait une seule requête par intervalle pour deux cloches", async () => {
    deuxCloches();
    await avancer(0);
    expect(getNotifications).toHaveBeenCalledTimes(1);
    await avancer(30_000);
    expect(getNotifications).toHaveBeenCalledTimes(2);
    await avancer(60_000);
    expect(getNotifications).toHaveBeenCalledTimes(4);
  });

  it("partage l'état entre les cloches", async () => {
    deuxCloches();
    await avancer(0);
    expect(screen.getAllByText("3")).toHaveLength(2);
  });

  it("suspend le sondage quand l'onglet est caché et reprend au retour", async () => {
    deuxCloches();
    await avancer(0);
    expect(getNotifications).toHaveBeenCalledTimes(1);

    changerVisibilite("hidden");
    await avancer(90_000);
    expect(getNotifications).toHaveBeenCalledTimes(1);

    changerVisibilite("visible");
    await avancer(0);
    expect(getNotifications).toHaveBeenCalledTimes(2);
    await avancer(30_000);
    expect(getNotifications).toHaveBeenCalledTimes(3);
  });

  it("arrête le sondage au démontage", async () => {
    const { unmount } = deuxCloches();
    await avancer(0);
    expect(getNotifications).toHaveBeenCalledTimes(1);
    unmount();
    await avancer(60_000);
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit à l'ouverture du panneau", async () => {
    deuxCloches();
    await avancer(0);
    expect(getNotifications).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole("button", { name: "Notifications" })[0]);
    await avancer(0);
    expect(getNotifications).toHaveBeenCalledTimes(2);
  });
});

describe("useNotifications", () => {
  it("lève une erreur hors fournisseur", () => {
    const erreurConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useNotifications())).toThrow(
      "useNotifications doit être utilisé dans un NotificationsProvider",
    );
    erreurConsole.mockRestore();
  });
});
