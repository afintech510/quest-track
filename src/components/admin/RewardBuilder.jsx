import { useState } from 'react';
import useDeviceType from '../../hooks/useDeviceType';
import { useToast } from '../layout/Toast';
import { FAMILY_ID } from '../../lib/constants';
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';

export default function RewardBuilder({ supabase, rewards, refreshData, sessionToken }) {
  const deviceType = useDeviceType();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', icon: '🎁', cost: 10, max_per_day: 1 });

  if (deviceType === 'tv') return null;

  const resetForm = () => {
    setForm({ title: '', icon: '🎁', cost: 10, max_per_day: 1 });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (reward) => {
    setForm({ title: reward.title, icon: reward.icon || '🎁', cost: reward.cost, max_per_day: reward.max_per_day || 1 });
    setEditing(reward.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const fn = editing ? 'update-reward' : 'create-reward';
      const body = editing
        ? { id: editing, ...form }
        : { family_id: FAMILY_ID, ...form };
      const { error } = await supabase.functions.invoke(fn, { body, headers: { 'x-session-token': sessionToken } });
      if (error) throw error;
      showToast(editing ? 'Reward updated!' : 'Reward added!', 'success');
      resetForm();
      refreshData();
    } catch {
      showToast('Failed to save reward', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-reward', { body: { id }, headers: { 'x-session-token': sessionToken } });
      if (error) throw error;
      showToast('Reward removed', 'info');
      refreshData();
    } catch {
      showToast('Failed to delete reward', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-fredoka text-base text-white">Manage Rewards</h3>
        {!showForm && (
          <button
            className="flex items-center gap-1 bg-primary hover:bg-primary-dark text-white font-quicksand text-sm px-3 py-1.5 rounded-lg"
            onClick={() => setShowForm(true)}
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-fredoka text-sm text-white">{editing ? 'Edit Reward' : 'New Reward'}</p>
            <button onClick={resetForm}><X size={16} className="text-slate-400" /></button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Icon"
              value={form.icon}
              onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))}
              className="w-16 bg-slate-700 text-white text-center text-xl rounded-lg px-2 py-2 border border-slate-600"
            />
            <input
              type="text"
              placeholder="Reward title"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className="flex-1 bg-slate-700 text-white font-quicksand text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-primary outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Cost (coins)</label>
              <input
                type="number"
                value={form.cost}
                onChange={(e) => setForm(f => ({ ...f, cost: parseInt(e.target.value) || 0 }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
                min="0"
              />
            </div>
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Max/day</label>
              <input
                type="number"
                value={form.max_per_day}
                onChange={(e) => setForm(f => ({ ...f, max_per_day: parseInt(e.target.value) || 1 }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
                min="1"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-fredoka py-2 rounded-lg flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {editing ? 'Update' : 'Create'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {(rewards || []).map(reward => (
          <div key={reward.id} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
            <span className="text-lg">{reward.icon || '🎁'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-quicksand text-sm text-white truncate">{reward.title}</p>
              <p className="font-quicksand text-xs text-slate-500">{reward.cost} coins · max {reward.max_per_day || '∞'}/day</p>
            </div>
            <button
              className="p-1.5 rounded hover:bg-slate-700"
              onClick={() => startEdit(reward)}
            >
              <Pencil size={14} className="text-slate-400" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-red-500/20"
              onClick={() => handleDelete(reward.id)}
            >
              <Trash2 size={14} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
