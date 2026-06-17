import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Smartphone } from 'lucide-react';
// ============ Dashboard Payment Numbers ============
const PaymentNumbersManager: React.FC = () => {
    const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
    const [networks, setNetworks] = useState<any[]>([]);
    const [form, setForm] = useState({ network: '', number: '', name: '' });
    const [editingId, setEditingId] = useState<number|null>(null);

    useEffect(() => {
        api.get('/api/lipa-numbers/').then(r => setLipaNumbers(r.data.results || r.data)).catch(() => {});
        api.get('/api/mobile-networks/').then(r => setNetworks(r.data.results || r.data)).catch(() => {});
    }, []);

    const handleSave = async () => {
        try {
            if (editingId) {
                await api.patch(`/api/lipa-numbers/${editingId}/`, form);
            } else {
                await api.post('/api/lipa-numbers/', form);
            }
            api.get('/api/lipa-numbers/').then(r => setLipaNumbers(r.data.results || r.data));
            setForm({ network: '', number: '', name: '' });
            setEditingId(null);
            toast.success('Payment number saved');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to save payment number');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/api/lipa-numbers/${id}/`);
            setLipaNumbers(prev => prev.filter(l => l.id !== id));
            toast.success('Removed');
        } catch {
            toast.error('Failed to remove');
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Numbers</h2>
            <p className="text-sm text-gray-500">These numbers are shown to buyers when they need to pay for your products offline.</p>
            {/* Form */}
            <div className="card p-5 space-y-3">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">{editingId ? 'Edit Number' : 'Add New Number'}</h3>
                <select value={form.network} onChange={e => setForm({...form, network: e.target.value})} className="input text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 w-full p-3 border dark:border-gray-600 rounded-lg">
                    <option value="">Select Network</option>
                    {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <input placeholder="Phone Number e.g. 0712345678" value={form.number}
                    onChange={e => setForm({...form, number: e.target.value})} className="input text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 w-full p-3 border dark:border-gray-600 rounded-lg" />
                <input placeholder="Account Name (shown to buyer)" value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})} className="input text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 w-full p-3 border dark:border-gray-600 rounded-lg" />
                <button onClick={handleSave} className="btn-primary w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition">
                    {editingId ? 'Update' : 'Add Number'}
                </button>
            </div>
            {/* List */}
            <div className="flex flex-wrap gap-3">
                {lipaNumbers.map(lipa => (
                    <div key={lipa.id} className="flex-1 min-w-[300px] card p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 ${lipa.network_logo ? 'w-24 h-14' : 'w-14 h-14'}`}>
                                {lipa.network_logo ? (
                                    <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                                ) : (
                                    <Smartphone size={24} className="text-gray-400" />
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">{lipa.network_name}</p>
                                <p className="text-gray-900 dark:text-white font-mono">{lipa.number}</p>
                                <p className="text-xs text-gray-500">{lipa.name}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingId(lipa.id); setForm({network: lipa.network, number: lipa.number, name: lipa.name}); }}
                                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition">Edit</button>
                            <button onClick={() => handleDelete(lipa.id)} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs hover:bg-red-200 dark:hover:bg-red-900/50 transition">Remove</button>
                        </div>
                    </div>
                ))}
                {lipaNumbers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No payment numbers yet. Add one above.</p>}
            </div>
        </div>
    );
};


export default PaymentNumbersManager;
