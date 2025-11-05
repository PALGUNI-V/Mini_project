import React, { useState, useEffect } from 'react';
import { fileAPI } from '../services/api';
import '../styles/Modal.css';

const AuditLogsModal = ({ file, onClose, formatDate }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, [file._id]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await fileAPI.getAuditLogs(file._id);
      setLogs(response.data.data.logs);
    } catch (err) {
      setError('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      upload: '📤',
      download: '⬇️',
      share: '👥',
      unshare: '🚫',
      delete: '🗑️',
      view: '👁️'
    };
    return icons[action] || '📋';
  };

  const getActionColor = (action) => {
    const colors = {
      upload: '#4CAF50',
      download: '#2196F3',
      share: '#FF9800',
      unshare: '#F44336',
      delete: '#F44336',
      view: '#9E9E9E'
    };
    return colors[action] || '#666';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Audit Logs - "{file.originalName}"</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <p>No activity recorded yet</p>
            </div>
          ) : (
            <div className="audit-logs-list">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>User</th>
                    <th>Target User</th>
                    <th>Timestamp</th>
                    
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td>
                        <span 
                          className="action-badge"
                          style={{ 
                            backgroundColor: getActionColor(log.action),
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}
                        >
                          {getActionIcon(log.action)} {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="user-cell">
                          <span>👤</span>
                          <div>
                            <p className="log-username">
                              {log.performedBy.username}
                            </p>
                            <p className="log-email">
                              {log.performedBy.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {log.targetUser ? (
                          <div className="user-cell">
                            <span>👤</span>
                            <div>
                              <p className="log-username">
                                {log.targetUser.username}
                              </p>
                              <p className="log-email">
                                {log.targetUser.email}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="not-applicable">-</span>
                        )}
                      </td>
                      <td>{formatDate(log.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsModal;