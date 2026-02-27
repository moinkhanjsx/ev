import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/auth.js";
import socketService from "../utils/socket.js";

const RequestChat = ({ requestId, peerName, requestStatus }) => {
  const { state } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [chatDisabled, setChatDisabled] = useState(false);
  const [chatNotice, setChatNotice] = useState("");
  const bottomRef = useRef(null);

  const myUserId = (state.user?._id || state.user?.id || "").toString();

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      setError("");

      try {
        if (requestStatus && !["ACCEPTED", "COMPLETED"].includes(requestStatus)) {
          setChatDisabled(true);
          setChatNotice("Chat is available only after a request is accepted.");
        } else {
          setChatDisabled(false);
          setChatNotice("");
        }

        const response = await api.get(`/charging/requests/${requestId}/messages`);
        if (isMounted) {
          setMessages(response.data?.messages || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || "Failed to load messages");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!state.token) return;

    socketService.connect(null, state.user?.city, state.token);
    socketService.emit("join-request", { requestId });

    const onChatMessage = (payload) => {
      if (!payload || payload.requestId !== requestId) return;
      setMessages((prev) => [...prev, payload.message]);
    };

    socketService.on("chat-message", onChatMessage);

    const onRequestExpired = (payload) => {
      const id = payload?.request?.id || payload?.requestId;
      if (id !== requestId) return;
      setChatDisabled(true);
      setChatNotice("This request expired. Chat is now closed.");
      setError("Chat closed due to expiration.");
      socketService.emit("leave-request", { requestId });
    };

    const onRequestCanceled = (payload) => {
      const id = payload?.request?.id || payload?.requestId;
      if (id !== requestId) return;
      setChatDisabled(true);
      setChatNotice("This request was canceled. Chat is now closed.");
      setError("Chat closed due to cancellation.");
      socketService.emit("leave-request", { requestId });
    };

    socketService.on("request-expired", onRequestExpired);
    socketService.on("request-expired-notification", onRequestExpired);
    socketService.on("request-canceled", onRequestCanceled);
    socketService.on("request-canceled-by-requester", onRequestCanceled);

    return () => {
      socketService.emit("leave-request", { requestId });
      socketService.off("chat-message", onChatMessage);
      socketService.off("request-expired", onRequestExpired);
      socketService.off("request-expired-notification", onRequestExpired);
      socketService.off("request-canceled", onRequestCanceled);
      socketService.off("request-canceled-by-requester", onRequestCanceled);
    };
  }, [requestId, state.token, state.user?.city]);

  const handleSend = async (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || chatDisabled) return;

    setText("");
    setError("");

    if (socketService.isConnected()) {
      socketService.emit("chat-message", { requestId, text: trimmed });
      return;
    }

    try {
      await api.post(`/charging/requests/${requestId}/messages`, { text: trimmed });
    } catch (err) {
      const message = err.response?.data?.message || "Failed to send message";
      setError(message);
      if (message.toLowerCase().includes("chat is available only after")) {
        setChatDisabled(true);
      }
    }
  };

  const handleShareContact = async () => {
    setError("");
    try {
      await api.post(`/charging/requests/${requestId}/share-contact`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to share contact");
    }
  };

  const displayMessages = useMemo(() => messages || [], [messages]);

  return (
    <div className="ev-chat-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Chat</h3>
          <p className="ev-formal-subtitle">With {peerName || "your helper"}</p>
        </div>
        <button type="button" className="ev-formal-button" onClick={handleShareContact}>
          Share Contact
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6">
          <div className="ev-loading mx-auto mb-3"></div>
          <p className="ev-formal-subtitle">Loading messages...</p>
        </div>
      ) : (
        <div className="ev-chat-list">
          {displayMessages.length === 0 ? (
            <p className="ev-formal-subtitle">No messages yet. Start the conversation.</p>
          ) : (
            displayMessages.map((message) => {
              const senderIdRaw =
                typeof message.senderId === "object"
                  ? message.senderId?._id || message.senderId?.id || message.senderId?.toString?.()
                  : message.senderId;
              const senderId = (senderIdRaw || "").toString();
              const isMine = senderId && senderId === myUserId;
              const isContact = message.type === "contact";

              return (
                <div
                  key={message._id || `${message.createdAt}-${message.senderId}`}
                  className={`ev-chat-bubble ${isMine ? "ev-chat-bubble-me" : ""}`}
                >
                  <div className="ev-chat-meta">
                    {isMine ? "You" : message.senderName}
                  </div>
                  {isContact ? (
                    <div>
                      <div>Contact shared</div>
                      {message.metadata?.phoneMasked && (
                        <div className="ev-chat-meta">Phone: {message.metadata.phoneMasked}</div>
                      )}
                      {message.metadata?.emailMasked && (
                        <div className="ev-chat-meta">Email: {message.metadata.emailMasked}</div>
                      )}
                    </div>
                  ) : (
                    <div>{message.text}</div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {chatNotice && <div className="ev-chat-error">{chatNotice}</div>}
      {error && <div className="ev-chat-error">{error}</div>}

      <form onSubmit={handleSend} className="ev-chat-input-row mt-4">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="ev-input ev-formal-input w-full"
          placeholder="Type a message..."
          disabled={chatDisabled}
        />
        <button type="submit" className="ev-formal-button" disabled={chatDisabled}>
          Send
        </button>
      </form>
    </div>
  );
};

export default RequestChat;
