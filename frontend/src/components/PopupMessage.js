import React, { useEffect, useState } from "react";
import "../styles/Modal.css"; // ✅ adjust path if needed

const PopupMessage = ({ message, type = "success", onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Show popup for 3 seconds, then fade out smoothly
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for fade-out
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`popup-message ${type} ${visible ? "show" : "hide"}`}>
      <p>{message}</p>
    </div>
  );
};

export default PopupMessage;
