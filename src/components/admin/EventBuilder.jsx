import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, CalendarPlus } from 'lucide-react';
import useDeviceType from '../../hooks/useDeviceType';
import { useToast } from '../layout/Toast';
import { FAMILY_ID } from '../../lib/constants';

const CATEGORIES = [
  { value: 'extracurricular', label: 'Extracurricular' },
  { value: 'medical', label: 'Medical' },
  { value: 'school', label: 'School' },
  { value: 'family', label: 'Family' },
  { value: 'other', label: 'Other' },
];

const FREQUENCIES = [
  { value: '', label: 'None (one-time)' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function buildRRule(frequency) {
  if (frequency === 'weekly') return 'FREQ=WEEKLY';
  if (frequency === 'daily') return 'FREQ=DAILY';
  if (frequency === 'monthly') return 'FREQ=MONTHLY';
  return null;
}

export default function EventBuilder({ calendarEvents, kids, sessionToken, refreshData }) {
  const deviceType = useDeviceType();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', category: 'family', kid_id: '', start_time: '', end_time: '',
    frequency: '', is_someday: false,
  });

  if (deviceType === 'tv') return null;

  const parentFetch = async (fnName, body) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
      body: JSON.stringify(body),
    });
    return response.json();
  };

  const resetForm = () => {
    setForm({ title: '', category: 'family', kid_id: '', start_time: '', end_time: '', frequency: '', is_someday: false });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (event) => {
    setForm({
      title: event.title,
      category: event.category || 'family',
      kid_id: event.kid_id || '',
      start_time: event.start_time ? event.start_time.slice(0, 16) : '',
      end_time: event.end_time ? event.end_time.slice(0, 16) : '',
      frequency: '',
      is_someday: event.is_someday || false,
    });
    setEditing(event.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const rrule = buildRRule(form.frequency);
      if (editing) {
        const data = await parentFetch('update-calendar-event', {
          id: editing,
          title: form.title,
          category: form.category,
          kid_id: form.kid_id || null,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          rrule,
          is_someday: form.is_someday,
        });
        if (data.status === 'success') showToast('Event updated!', 'success');
        else throw new Error(data.message);
      } else {
        const data = await parentFetch('create-calendar-event', {
          family_id: FAMILY_ID,
          title: form.title,
          category: form.category,
          kid_id: form.kid_id || null,
          start_time: form.start_time || new Date().toISOString(),
          end_time: form.end_time || null,
          rrule,
          is_someday: form.is_someday,
        });
        if (data.status === 'success') showToast('Event created!', 'success');
        else throw new Error(data.message);
      }
      resetForm();
      await refreshData();
    } catch {
      showToast('Failed to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      const data = await parentFetch('delete-calendar-event', { id });
      if (data.status === 'success') {
        showToast('Event deleted', 'info');
        await refreshData();
      } else {
        throw new Error(data.message);
      }
    } catch {
      showToast('Failed to delete event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const events = (calendarEvents || []).filter(e => !e.deleted_at);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-fredoka text-base text-white flex items-center gap-2">
          <CalendarPlus size={16} className="text-primary" />
          Manage Events
        </h3>
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
            <p className="font-fredoka text-sm text-white">{editing ? 'Edit Event' : 'New Event'}</p>
            <button onClick={resetForm}><X size={16} className="text-slate-400" /></button>
          </div>
          <input
            type="text"
            placeholder="Event title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full bg-slate-700 text-white font-quicksand text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-primary outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Assign To</label>
              <select
                value={form.kid_id}
                onChange={e => setForm(f => ({ ...f, kid_id: e.target.value }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
              >
                <option value="">Family</option>
                {kids?.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Start</label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
              />
            </div>
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">End</label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-quicksand text-xs text-slate-400 block mb-1">Recurrence</label>
              <select
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-2 py-1.5 border border-slate-600"
              >
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_someday}
                  onChange={e => setForm(f => ({ ...f, is_someday: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary"
                />
                <span className="font-quicksand text-xs text-slate-300">Someday</span>
              </label>
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
        {events.slice(0, 20).map(event => (
          <div key={event.id} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-quicksand text-sm text-white truncate">{event.title}</p>
              <p className="font-quicksand text-xs text-slate-500">
                {event.category} {event.start_time ? `· ${new Date(event.start_time).toLocaleDateString()}` : ''}
                {event.is_someday ? ' · Someday' : ''}
              </p>
            </div>
            <button className="p-1.5 rounded hover:bg-slate-700" onClick={() => startEdit(event)}>
              <Pencil size={14} className="text-slate-400" />
            </button>
            <button className="p-1.5 rounded hover:bg-red-500/20" onClick={() => handleDelete(event.id)}>
              <Trash2 size={14} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
