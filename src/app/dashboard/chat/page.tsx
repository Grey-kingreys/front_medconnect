"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { getConversations, getMessages, startConversation, Conversation, Message } from "@/lib/api_chat";
import { 
  Send, MapPin, Loader2, User as UserIcon, Building2, Phone, Search, AlertCircle, Menu, ArrowLeft
} from "lucide-react";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMsg, setInputMsg] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Socket.io
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"]
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch Conversations
  useEffect(() => {
    const fetchConvs = async () => {
      try {
        const res = await getConversations();
        setConversations(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConvs();
  }, []);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("newMessage", (message: Message) => {
      if (activeConv && message.conversationId === activeConv.id) {
        setMessages(prev => [...prev, message]);
      }
      
      // Update last message in sidebar
      setConversations(prev => prev.map(conv => {
        if (conv.id === message.conversationId) {
          return {
            ...conv,
            messages: [message],
            updatedAt: message.createdAt
          };
        }
        return conv;
      }));
    });

    return () => {
      socket.off("newMessage");
    };
  }, [socket, activeConv]);

  // Load Messages when active conversation changes
  useEffect(() => {
    if (!activeConv) return;
    
    const fetchMsgs = async () => {
      try {
        const res = await getMessages(activeConv.id);
        setMessages(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchMsgs();
    
    if (socket) {
      socket.emit("joinConversation", activeConv.id);
    }
  }, [activeConv, socket]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMsg.trim() || !activeConv || !socket) return;

    socket.emit("sendMessage", {
      conversationId: activeConv.id,
      content: inputMsg
    });

    setInputMsg("");
  };

  const handleSendLocation = () => {
    if (!activeConv || !socket) return;
    
    setLocationLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          socket.emit("sendMessage", {
            conversationId: activeConv.id,
            content: "📍 Position partagée",
            isLocation: true,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationLoading(false);
        },
        (error) => {
          console.error("Error getting location", error);
          setLocationLoading(false);
          alert("Impossible de récupérer votre position.");
        }
      );
    } else {
      setLocationLoading(false);
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
    }
  };

  const getConvName = (conv: Conversation) => {
    if (user?.role === "PATIENT") {
      if (conv.type === "PRIVE") {
        return `Dr. ${conv.medecin?.prenom} ${conv.medecin?.nom}`;
      } else {
        return conv.structure?.nom;
      }
    } else {
      // MEDECIN ou STRUCTURE
      return `${conv.patient?.prenom} ${conv.patient?.nom}`;
    }
  };

  const getConvIcon = (conv: Conversation) => {
    if (user?.role === "PATIENT") {
      return conv.type === "PRIVE" ? <UserIcon className="w-5 h-5 text-purple-500" /> : <Building2 className="w-5 h-5 text-primary-500" />;
    } else {
      return <UserIcon className="w-5 h-5 text-secondary-500" />;
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="h-[calc(100vh-120px)] bg-white dark:bg-[#0f172a]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl flex animate-fade-in">
      
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-full md:w-80' : 'hidden md:block md:w-80'} flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 flex flex-col bg-slate-50/50 dark:bg-slate-900/30`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/50">
          <h2 className="text-xl font-black text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-outfit)" }}>Messagerie</h2>
          
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher une conversation..." 
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center p-4 mt-10">
              <p className="text-sm text-slate-500">Aucune conversation</p>
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = activeConv?.id === conv.id;
              const lastMessage = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;
              
              return (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConv(conv); setShowSidebar(false); }}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex gap-3 ${isActive ? 'bg-primary-500/10 shadow-sm border border-primary-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white dark:bg-slate-800' : 'bg-white dark:bg-slate-900 shadow-sm'}`}>
                    {getConvIcon(conv)}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className={`font-bold truncate ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white'}`}>
                        {getConvName(conv)}
                      </p>
                    </div>
                    {lastMessage && (
                      <p className="text-xs text-slate-500 truncate">
                        {lastMessage.isLocation ? '📍 Position partagée' : lastMessage.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`${!showSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white dark:bg-[#0a0f1e]/80`}>
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-slate-200 dark:border-slate-800/50 flex items-center px-4 justify-between bg-white dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowSidebar(true)} className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  {getConvIcon(activeConv)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{getConvName(activeConv)}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En ligne
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === user?.id;
                
                return (
                  <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl p-3 ${isMe ? 'bg-primary-500 text-white rounded-br-none shadow-md shadow-primary-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none'}`}>
                      {msg.isLocation ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            <span className="font-bold">Position partagée</span>
                          </div>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${msg.latitude},${msg.longitude}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-block px-3 py-1.5 bg-black/20 hover:bg-black/30 rounded-lg text-sm font-medium transition-colors"
                          >
                            Ouvrir dans Maps
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-100' : 'text-slate-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all overflow-hidden flex items-center">
                  <textarea
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Écrivez un message..."
                    className="w-full max-h-32 min-h-[50px] p-3 text-sm focus:outline-none resize-none bg-transparent dark:text-white"
                    rows={1}
                  />
                  {user?.role === "PATIENT" && (
                    <button 
                      onClick={handleSendLocation}
                      disabled={locationLoading}
                      title="Partager ma position"
                      className="p-3 text-slate-400 hover:text-primary-500 transition-colors"
                    >
                      {locationLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMsg.trim()}
                  className="w-12 h-[50px] rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/25 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <Send className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Vos messages</h3>
            <p className="text-slate-500 max-w-sm">
              Sélectionnez une conversation sur la gauche pour commencer à échanger de manière sécurisée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
