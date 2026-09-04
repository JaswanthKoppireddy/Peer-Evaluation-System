import React, { useState } from 'react';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, X, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from the current password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success(res.data.message || 'Password updated successfully!');
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="modal-icon-wrap">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h2 id="change-password-title" className="text-lg font-bold" style={{ color: 'var(--primary-text)' }}>
              Change Password
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="modal-close-btn"
            aria-label="Close modal"
            id="close-password-modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          {/* Current Password */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="current-password">
              <Lock size={13} className="inline mr-1.5" />
              Current Password
            </label>
            <div className="modal-input-wrap">
              <input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="modal-input"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="modal-eye-btn"
                tabIndex={-1}
                aria-label="Toggle current password visibility"
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="new-password">
              <Lock size={13} className="inline mr-1.5" />
              New Password
            </label>
            <div className="modal-input-wrap">
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="modal-input"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="modal-eye-btn"
                tabIndex={-1}
                aria-label="Toggle new password visibility"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Strength indicator */}
            {newPassword && (
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4].map((i) => {
                  const score =
                    (newPassword.length >= 6 ? 1 : 0) +
                    (/[A-Z]/.test(newPassword) ? 1 : 0) +
                    (/[0-9]/.test(newPassword) ? 1 : 0) +
                    (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0);
                  const active = i <= score;
                  const color =
                    score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-orange-400' : score === 3 ? 'bg-yellow-400' : 'bg-green-500';
                  return (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${active ? color : 'bg-gray-200 dark:bg-gray-700'}`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="confirm-password">
              <Lock size={13} className="inline mr-1.5" />
              Confirm New Password
            </label>
            <div className="modal-input-wrap">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="modal-input"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="modal-eye-btn"
                tabIndex={-1}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPassword && newPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
            {confirmPassword && newPassword && confirmPassword === newPassword && (
              <p className="text-xs text-green-500 mt-1">✓ Passwords match</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 modal-cancel-btn"
              id="cancel-password-change"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 modal-submit-btn"
              id="submit-password-change"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
