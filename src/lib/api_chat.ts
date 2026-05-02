import { authFetch } from "./api_auth";

export interface Conversation {
  id: string;
  type: "PRIVE" | "STRUCTURE";
  patientId?: string;
  medecinId?: string;
  structureId?: string;
  patient?: any;
  medecin?: any;
  structure?: any;
  messages: Message[];
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isLocation: boolean;
  latitude?: number;
  longitude?: number;
  lu: boolean;
  createdAt: string;
  sender?: {
    id: string;
    nom: string;
    prenom: string;
    role: string;
  }
}

export async function getConversations() {
  return authFetch<Conversation[]>("/chat/conversations");
}

export async function getMessages(conversationId: string) {
  return authFetch<Message[]>(`/chat/conversations/${conversationId}/messages`);
}

export async function startConversation(targetId: string, type: "PRIVE" | "STRUCTURE") {
  return authFetch<Conversation>("/chat/conversations/start", {
    method: "POST",
    body: JSON.stringify({ targetId, type })
  });
}
