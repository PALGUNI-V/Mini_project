import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import { fileAPI } from "../services/api";
import FileUpload from "../components/FileUpload";
import FileList from "../components/FileList";
import ShareModal from "../components/ShareModal";
import AuditLogsModal from "../components/AuditLogsModal";
import PopupMessage from "../components/PopupMessage"; // ✅ Add this line
import "../styles/Dashboard.css";

const Dashboard = () => {
  const [ownedFiles, setOwnedFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [shareModalFile, setShareModalFile] = useState(null);
  const [auditLogsFile, setAuditLogsFile] = useState(null);
  const [activeTab, setActiveTab] = useState("owned");
  const [popup, setPopup] = useState({ show: false, message: "", type: "" }); // ✅ Popup state

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ✅ Reusable popup function
  const showPopup = (message, type = "success") => {
    setPopup({ show: true, message, type });
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fileAPI.getFiles();
      setOwnedFiles(response.data.data.ownedFiles);
      setSharedFiles(response.data.data.sharedFiles);
      setError("");
    } catch (err) {
      setError("Failed to fetch files");
      showPopup("⚠️ Failed to fetch files.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    fetchFiles();
    showPopup("✅ File uploaded successfully!", "success");
  };

  const handleDownload = async (file) => {
    try {
      const response = await fileAPI.downloadFile(file._id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showPopup(`✅ ${file.originalName} downloaded successfully!`, "success");
    } catch (err) {
      console.error("Download error:", err);
      showPopup("❌ Failed to download file.", "error");
    }
  };

  
 const handleDelete = async (fileId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`http://localhost:5000/api/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      // ✅ Show success popup immediately
      showPopup("🗑️ File deleted successfully", "success");

      // ⏳ Delay refresh slightly so popup has time to display
      setTimeout(() => {
        fetchFiles(); // ✅ Correct function name
      }, 400); // 400ms = smooth timing for popup visibility
    } else {
      // ⚠️ Show error popup
      showPopup(data.message || "❌ Failed to delete file", "error");
    }
  } catch (error) {
    showPopup("⚠️ Error deleting file", "error");
  }
};



  const handleShare = (file) => setShareModalFile(file);
  const handleViewAuditLogs = (file) => setAuditLogsFile(file);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>🔐 AquaCrypt</h1>
        </div>
        <div className="navbar-user">
          <span>Welcome, {user?.username}</span>
          <button onClick={handleLogout} className="btn-secondary">
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h2>My Vault</h2>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            + Upload File
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="tabs">
          <button
            className={`tab ${activeTab === "owned" ? "active" : ""}`}
            onClick={() => setActiveTab("owned")}
          >
            My Files ({ownedFiles.length})
          </button>
          <button
            className={`tab ${activeTab === "shared" ? "active" : ""}`}
            onClick={() => setActiveTab("shared")}
          >
            Shared With Me ({sharedFiles.length})
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading files...</div>
        ) : (
          <>
            {activeTab === "owned" && (
              <FileList
                files={ownedFiles}
                isOwner={true}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onShare={handleShare}
                onViewAuditLogs={handleViewAuditLogs}
                formatFileSize={formatFileSize}
                formatDate={formatDate}
              />
            )}
            {activeTab === "shared" && (
              <FileList
                files={sharedFiles}
                isOwner={false}
                onDownload={handleDownload}
                formatFileSize={formatFileSize}
                formatDate={formatDate}
              />
            )}
          </>
        )}
      </div>

      {showUpload && (
        <FileUpload
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {shareModalFile && (
        <ShareModal
          file={shareModalFile}
          onClose={() => setShareModalFile(null)}
          onSuccess={fetchFiles}
        />
      )}

      {auditLogsFile && (
        <AuditLogsModal
          file={auditLogsFile}
          onClose={() => setAuditLogsFile(null)}
          formatDate={formatDate}
        />
      )}

      {/* ✅ Popup message */}
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

export default Dashboard;
