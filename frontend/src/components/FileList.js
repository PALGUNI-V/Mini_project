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