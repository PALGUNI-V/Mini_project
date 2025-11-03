import React from 'react';
import '../styles/FileList.css';

const FileList = ({ 
  files, 
  isOwner, 
  onDownload, 
  onDelete, 
  onShare, 
  onViewAuditLogs,
  formatFileSize,
  formatDate 
}) => {

  // ✅ Simplified Integrity Verification Function
 const verifyIntegrity = async (file) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in again — missing token.');
      return;
    }

    const response = await fetch(`http://localhost:5000/api/files/verify/${file._id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`, // ✅ Include JWT token here
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      alert('❌ Unauthorized — please log in again.');
      return;
    }

    const data = await response.json();

    if (data.match) {
      alert(`✅ Integrity verified for ${file.originalName}`);
      console.log('Watermark:', data.watermarkData);
    } else {
      alert(`⚠️ Integrity mismatch for ${file.originalName}`);
    }
  } catch (error) {
    console.error('Error verifying integrity:', error);
    alert('Error verifying file integrity.');
  }
};


  if (files.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">📂</span>
        <p>No files to display</p>
        {isOwner && <p className="empty-hint">Upload your first file to get started</p>}
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
                    <span className="shared-count">{file.sharedWith.length} user(s)</span>
                  ) : (
                    <span className="not-shared">Not shared</span>
                  )}
                </td>
              )}

              {/* 🧩 Integrity Column */}
              <td>
                <div className="integrity-cell">
                  <code>{file.integrityHash?.slice(0, 10)}...</code>
                  <button
                    onClick={() => verifyIntegrity(file)}
                    className="btn-action btn-verify"
                    title="Verify Integrity"
                  >
                    ✅
                  </button>
                </div>
              </td>

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
                        title="Share"
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
    </div>
  );
};

export default FileList;
