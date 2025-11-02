import React, { useState } from 'react';
import { authAPI, fileAPI } from '../services/api';
import '../styles/Modal.css';

const ShareModal = ({ file, onClose, onSuccess }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setError('');
    setSuccess('');

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await authAPI.searchUsers(query);
      setSearchResults(response.data.data.users);
    } catch (err) {
      setError('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleShare = async (user) => {
    setSharing(true);
    setError('');
    setSuccess('');

    try {
      await fileAPI.shareFile(file._id, { userId: user._id });
      setSuccess(`File shared with ${user.username}`);
      setSearchQuery('');
      setSearchResults([]);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to share file');
    } finally {
      setSharing(false);
    }
  };

  const handleUnshare = async (userId) => {
    if (!window.confirm('Remove access for this user?')) return;

    try {
      await fileAPI.unshareFile(file._id, userId);
      setSuccess('Access removed successfully');
      onSuccess();
    } catch (err) {
      setError('Failed to remove access');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share "{file.originalName}"</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* Search Users */}
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

          {/* Currently Shared With */}
          <div className="shared-users-section">
            <h3>Currently shared with</h3>
            {file.sharedWith.length === 0 ? (
              <p className="no-shares">Not shared with anyone yet</p>
            ) : (
              <div className="shared-users-list">
                {file.sharedWith.map((share) => (
                  <div key={share.user._id} className="shared-user-item">
                    <div className="user-info">
                      <span className="user-icon">👤</span>
                      <div>
                        <p className="username">{share.user.username}</p>
                        <p className="email">{share.user.email}</p>
                        <p className="shared-date">
                          Shared on {new Date(share.sharedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnshare(share.user._id)}
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
    </div>
  );
};

export default ShareModal;