import React, { useState } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

interface DisputeModalProps {
  orderId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const DisputeModal: React.FC<DisputeModalProps> = ({ orderId, onClose, onSuccess }) => {
  const [disputeForm, setDisputeForm] = useState({ reason: '', evidence_description: '', target_item: '' });
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDispute(true);
    const formData = new FormData();
    formData.append('order', orderId.toString());
    formData.append('reason', disputeForm.reason);
    formData.append('evidence_description', disputeForm.evidence_description);
    if (disputeForm.target_item) formData.append('target_item', disputeForm.target_item);
    if (disputeFile) formData.append('evidence_image', disputeFile);

    try {
      await api.post('/api/disputes/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Dispute opened successfully. Staff will review it shortly.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to open dispute');
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="card w-full max-w-md p-6 animate-slide-up shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600" />
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
            </button>
            
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Open a Dispute</h3>
                <p className="text-sm text-gray-500 mt-1">Order #{orderId}</p>
            </div>
            
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Reason for Dispute</label>
                    <select 
                        value={disputeForm.reason}
                        onChange={(e) => setDisputeForm({...disputeForm, reason: e.target.value})}
                        required
                        className="input text-sm h-10 w-full"
                    >
                        <option value="">Select a reason...</option>
                        <option value="item_not_received">Item not received</option>
                        <option value="item_defective">Item defective/damaged</option>
                        <option value="item_not_as_described">Item not as described</option>
                        <option value="wrong_item">Wrong item delivered</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Details</label>
                    <textarea 
                        value={disputeForm.evidence_description}
                        onChange={(e) => setDisputeForm({...disputeForm, evidence_description: e.target.value})}
                        required
                        rows={3}
                        placeholder="Please explain the issue in detail..."
                        className="input text-sm resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Evidence Image (Optional)</label>
                    <input type="file" className="input text-sm p-1.5 w-full" accept="image/*" onChange={(e) => setDisputeFile(e.target.files?.[0] || null)} />
                </div>
                
                <button 
                    type="submit" 
                    disabled={submittingDispute}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20"
                >
                    {submittingDispute ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <AlertTriangle size={20} />}
                    Submit Dispute
                </button>
            </form>
        </div>
    </div>
  );
};

export default DisputeModal;
