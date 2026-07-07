import { useState } from 'react';
import useDeviceType from '../../hooks/useDeviceType';
import { useToast } from '../layout/Toast';
import { FAMILY_ID } from '../../lib/constants';
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';

export default function ChoreBuilder({ supabase, choreEvents, refreshData, sessionToken }) {
  const deviceType = useDeviceType();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', frequency: 'daily', xp_reward: 10, coin_reward: 5 });

  if (deviceType === 'tv') return null;

  const chores = [];
  const seen = new Set();
  for (const event of choreEvents || []) {
    const def = event.chore_definitions;
    if (def && !def.deleted_at && !seen.has(def.id)) {
      seen.add(def.id);
      chores.push(def);
    }
  }

  const resetForm = () => {
    setForm({ title: '', frequency: 'daily', xp_reward: 10, coin_reward: 5 });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (chore) => {
    setForm({ title: chore.title, frequency: chore.frequency, xp_reward: chore.xp_reward, coin_reward: chore.coin_reward });
    setEditing(chore.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const fn = editing ? 'update-chore' : 'create-chore';
      const body = editing
        ? { id: editing, ...form }
        : { family_id: FAMILY_ID, ...form };
      const { error } = await supabase.functions.invoke(fn, { body, headers: { 'x-session-token': sessionToken } });
      if (error) throw error;
      showToast(editing ? 'Chore updated!' : 'Chore added!', 'success');
      resetForm();
      refreshData();
    } catch {
      showToast('Failed to save chore', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-chore', { body: { id }, headers: { 'x-session-token': sessionToken } });
      if (error) throw error;
      showToast('Chore removed', 'info');
      refreshData();
    } catch {
      showToast('Failed to delete chore', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-fredoka text-base text-white">Manage Chores</h3>
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
            <p className="font-fredoka text-sm text-white">{editing ? 'Edit Chore' : 'New Chore'}</p>
            <button onClick={resetForm}><X size={16} className="text-slate-400" /></button>
          </div>
          <input
            type="text"
            placeholder="Chore title"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full bg-slate-700 text-white font-quicksand text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-primary outline-none"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="once">Monthly</option>
              </select>
            </div>
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">XP</label>
              <input
                type="number"
                value={form.xp_reward}
                onChange={(e) => setForm(f => ({ ...f, xp_reward: parseInt(e.target.value) || 0 }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
                min="0"
              />
            </div>
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Coins</label>
              <input
                type="number"
                value={form.coin_reward}
                onChange={(e) => setForm(f => ({ ...f, coin_reward: parseInt(e.target.value) || 0 }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
                min="0"
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
        {chores.map(chore => (
          <div key={chore.id} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
            <span className="text-lg">{chore.icon || '⚔️'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-quicksand text-sm text-white truncate">{chore.title}</p>
              <p className="font-quicksand text-xs text-slate-500">
                {chore.frequency} · {chore.coin_reward} coins · {chore.xp_reward} XP
              </p>
            </div>
            <button
              className="p-1.5 rounded hover:bg-slate-700"
              onClick={() => startEdit(chore)}
            >
              <Pencil size={14} className="text-slate-400" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-red-500/20"
              onClick={() => handleDelete(chore.id)}
            >
              <Trash2 size={14} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
