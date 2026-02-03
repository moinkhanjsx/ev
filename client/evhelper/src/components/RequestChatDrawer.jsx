import React, { useEffect } from "react";
import RequestChat from "./RequestChat";

const RequestChatDrawer = ({ open, onClose, requestId, peerName }) => {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.body.classList.add("ev-no-scroll");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("ev-no-scroll");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ev-drawer" role="dialog" aria-modal="true">
      <div className="ev-drawer-backdrop" onClick={onClose} />
      <div className="ev-drawer-panel ev-drawer-panel-animate">
        <div className="ev-drawer-header">
          <div>
            <div className="ev-formal-title">Chat</div>
            <div className="ev-formal-subtitle">With {peerName || "your partner"}</div>
          </div>
          <button className="ev-formal-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ev-drawer-body">
          <RequestChat requestId={requestId} peerName={peerName} />
        </div>
      </div>
    </div>
  );
};

export default RequestChatDrawer;
