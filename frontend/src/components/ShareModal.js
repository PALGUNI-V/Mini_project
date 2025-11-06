import React, { useState } from "react";
import { authAPI, fileAPI } from "../services/api";
import PopupMessage from "./PopupMessage";
import ConfirmPopup from "./ConfirmPopup";
import "../styles/Modal.css";

const ShareModal = ({ file, onClose, onSuccess }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharedUsers, setSharedUsers] = useState(file.sharedWith || []);
  const [popup, setPopup] = useState({ show: false, message: "", type: "" });
  const [confirmPopup, setConfirmPopup] = useState({
    show: false,
    userId: null,
    username: "",
  });

  // ✅ Reusable popup function
  const showPopup = (message, type = "success") => {
    setPopup({ show: true, message, type });
  };

  // 🔍 Search for users
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await authAPI.searchUsers(query);
      setSearchResults(response.data.data.users);
    } catch {
      showPopup("⚠️ Failed to search users", "error");
    } finally {
      setSearching(false);
    }
  };

  // 📤 Share file
  const handleShare = async (user) => {
    setSharing(true);
    try {
      await fileAPI.shareFile(file._id, { userId: user._id });

      // ✅ Update shared users instantly (local state)
      setSharedUsers((prev) => [
        ...prev,
        {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
          },
          sharedAt: new Date(),
        },
      ]);

      showPopup(`✅ File shared with ${user.username}`, "success");

      // ✅ Clear search
      setSearchQuery("");
      setSearchResults([]);

      // ✅ Refresh dashboard silently
      onSuccess && onSuccess();
    } catch (err) {
      showPopup(
        err.response?.data?.message || "❌ Failed to share file",
        "error"
      );
    } finally {
      setSharing(false);
    }
  };

  // ❌ Confirm unshare
  const handleUnshareConfirm = (userId, username) => {
    setConfirmPopup({ show: true, userId, username });
  };

  // ✅ Proceed to unshare after confirmation
  const handleUnshare = async () => {
    try {
      await fileAPI.unshareFile(file._id, confirmPopup.userId);

      // ✅ Update UI instantly by removing user
      setSharedUsers((prev) =>
        prev.filter((share) => share.user._id !== confirmPopup.userId)
      );

      showPopup(`Access removed for ${confirmPopup.username}`, "success");
      onSuccess && onSuccess();
    } catch {
      showPopup("⚠️ Failed to remove access", "error");
    } finally {
      setConfirmPopup({ show: false, userId: null, username: "" });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share "{file.originalName}"</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 🔍 Search Users */}
          <div className="search-section">
            <h3>Share with user</h3>
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />

            {searching && <p className="searching">Searching...</p>}

            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((user) => (
                  <div key={user._id} className="search-result-item">
                    <div className="user-info">
                      <span className="user-icon">👤</span>
                      <div>
                        <p className="username">{user.username}</p>
                        <p className="email">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleShare(user)}
                      disabled={sharing}
                      className="btn-primary btn-small"
                    >
                      Share
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 👥 Currently Shared With */}
          <div className="shared-users-section">
            <h3>Currently shared with</h3>
            {sharedUsers.length === 0 ? (
              <p className="no-shares">Not shared with anyone yet</p>
            ) : (
              <div className="shared-users-list">
                {sharedUsers.map((share) => (
                  <div key={share.user._id} className="shared-user-item">
                    <div className="user-info">
                      <span className="user-icon">👤</span>
                      <div>
                        <p className="username">{share.user.username}</p>
                        <p className="email">{share.user.email}</p>
                        <p className="shared-date">
                          Shared on{" "}
                          {new Date(share.sharedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleUnshareConfirm(
                          share.user._id,
                          share.user.username
                        )
                      }
                      className="btn-danger btn-small"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>

      {/* ✅ Popup Message */}
      {popup.show && (
        <PopupMessage
          message={popup.message}
          type={popup.type}
          onClose={() => setPopup({ show: false, message: "", type: "" })}
        />
      )}

      {/* ✅ Styled Confirm Popup */}
      {confirmPopup.show && (
        <ConfirmPopup
          message={`Remove access for ${confirmPopup.username}?`}
          onConfirm={handleUnshare}
          onCancel={() =>
            setConfirmPopup({ show: false, userId: null, username: "" })
          }
        />
      )}
    </div>
  );
};

export default ShareModal;
