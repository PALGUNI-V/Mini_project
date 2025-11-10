import React, { useState } from "react";
import "../styles/Modal.css"
import "../styles/Dashboard.css"
import PopupMessage from "./PopupMessage"; // ✅ Add this component for popup notifications

const FileList = ({
  files,
  isOwner,
  onDownload,
  onDelete,
  onShare,
  onViewAuditLogs,
  formatFileSize,
  formatDate,
}) => {
  // ✅ Popup state
  const [popup, setPopup] = useState({ show: false, message: "", type: "" });

  // ✅ Reusable popup function
  const showPopup = (message, type = "success") => {
    setPopup({ show: true, message, type });
  };

  // ✅ Simplified Integrity Verification Function
  const verifyIntegrity = async (file) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showPopup("Please log in again — missing token.", "error");
        return;
      }

      const response = await fetch(
        `http://localhost:5000/api/files/verify/${file._id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 401) {
        showPopup("❌ Unauthorized — please log in again.", "error");
        return;
      }

      const data = await response.json();

      if (data.match) {
        showPopup(`✅ Integrity verified for ${file.originalName}`, "success");
        console.log("Watermark:", data.watermarkData);
      } else {
        showPopup(`⚠️ Integrity mismatch for ${file.originalName}`, "error");
      }
    } catch (error) {
      console.error("Error verifying integrity:", error);
      showPopup("Error verifying file integrity.", "error");
    }
  };

  // ✅ Empty state
  if (files.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">📂</span>
        <p>No files to display</p>
        {isOwner && (
          <p className="empty-hint">Upload your first file to get started</p>
        )}
        {popup.show && (
          <PopupMessage
            message={popup.message}
            type={popup.type}
            onClose={() => setPopup({ show: false, message: "", type: "" })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="file-list">
      <table className="file-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Size</th>
            <th>Owner</th>
            <th>Uploaded</th>
            {isOwner && <th>Shared With</th>}
            <th>Integrity</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {files.map((file) => (
            <tr key={file._id}>
              <td>
                <div className="file-name-cell">
                  <span className="file-icon">📄</span>
                  {file.originalName}
                </div>
              </td>

              <td>{formatFileSize(file.size)}</td>
              <td>{file.owner.username}</td>
              <td>{formatDate(file.uploadedAt)}</td>

              {isOwner && (
                <td>
                  {file.sharedWith.length > 0 ? (
                    <span className="shared-count">
                      {file.sharedWith.length} user(s)
                    </span>
                  ) : (
                    <span className="not-shared">Not shared</span>
                  )}
                </td>
              )}

              {/* ✅ Integrity Column — only button, no hash */}
              <td>
                <div className="integrity-cell">
                  <button
                    onClick={() => verifyIntegrity(file)}
                    className="btn-action btn-verify"
                    title="Verify File Integrity"
                  >
                     Verify
                  </button>
                </div>
              </td>

              {/* ✅ Actions */}
              <td>
                <div className="action-buttons">
                  <button
                    onClick={() => onDownload(file)}
                    className="btn-action btn-download"
                    title="Download"
                  >
                    ⬇️
                  </button>

                  {isOwner && (
                    <>
                      <button
  onClick={() => onShare(file)}
  className="btn-action btn-share"
  title={file.status === "tampered" ? "File Tampered — Sharing Disabled" : "Share"}
  disabled={file.status === "tampered"}   // 🚫 Disable only Share
  style={{
    opacity: file.status === "tampered" ? 0.5 : 1,
    cursor: file.status === "tampered" ? "not-allowed" : "pointer",
  }}
>
  👥
</button>

                      <button
                        onClick={() => onViewAuditLogs(file)}
                        className="btn-action btn-logs"
                        title="View Audit Logs"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => onDelete(file._id)}
                        className="btn-action btn-delete"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ✅ Popup component */}
      {popup.show && (
        <PopupMessage
          message={popup.message}
          type={popup.type}
          onClose={() => setPopup({ show: false, message: "", type: "" })}
        />
      )}
    </div>
  );
};

export default FileList;
