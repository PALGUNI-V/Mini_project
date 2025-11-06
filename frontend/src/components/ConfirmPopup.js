import React from "react";
import "../styles/Modal.css"; // unified style file

const ConfirmPopup = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="confirm-popup">
        <h3 className="confirm-title">⚠️ Confirmation Required</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-buttons">
          <button className="confirm-btn" onClick={onConfirm}>
            ✅ Confirm
          </button>
          <button className="cancel-btn" onClick={onCancel}>
            ✖ Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmPopup;
