"use client";

import { GripVertical, Trash2, Plus, X } from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Teks singkat" },
  { value: "textarea", label: "Teks panjang" },
  { value: "number", label: "Angka" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Pilihan ganda" },
  { value: "checkbox", label: "Centang (multi-pilih)" },
];

const NEEDS_OPTIONS = ["dropdown", "radio", "checkbox"];

/**
 * components/admin/FormFieldEditor.js
 *
 * Editor untuk satu elemen custom_form_fields
 * (Firestore: stores/{storeId}.custom_form_fields[] — lihat Modul 1 §1.1.1).
 *
 * Props:
 *  - field: { field_id, label, type, options, is_required, order }
 *  - onChange(updatedField)
 *  - onRemove()
 *  - onMove(direction: 'up' | 'down')
 */
export default function FormFieldEditor({ field, onChange, onRemove, onMove }) {
  const update = (patch) => onChange({ ...field, ...patch });

  const updateOption = (index, value) => {
    const next = [...field.options];
    next[index] = value;
    update({ options: next });
  };

  const addOption = () => update({ options: [...(field.options || []), ""] });

  const removeOption = (index) =>
    update({ options: field.options.filter((_, i) => i !== index) });

  return (
    <div className="group relative rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-2 text-[var(--muted)]">
          <button
            type="button"
            onClick={() => onMove("up")}
            className="hover:text-[var(--ink)] transition-colors"
            aria-label="Pindah ke atas"
          >
            ▲
          </button>
          <GripVertical size={16} strokeWidth={1.5} />
          <button
            type="button"
            onClick={() => onMove("down")}
            className="hover:text-[var(--ink)] transition-colors"
            aria-label="Pindah ke bawah"
          >
            ▼
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={field.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Label pertanyaan, mis. Ukuran / Catatan pesanan"
              className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--marigold)]"
            />
            <select
              value={field.type}
              onChange={(e) => {
                const type = e.target.value;
                update({
                  type,
                  options: NEEDS_OPTIONS.includes(type)
                    ? field.options?.length
                      ? field.options
                      : [""]
                    : [],
                });
              }}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--marigold)]"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {NEEDS_OPTIONS.includes(field.type) && (
            <div className="space-y-2 pl-1">
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)] w-4">{i + 1}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Pilihan ${i + 1}`}
                    className="flex-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="text-[var(--muted)] hover:text-[var(--brick)]"
                    aria-label="Hapus pilihan"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 text-xs font-medium text-[var(--pine)] hover:underline"
              >
                <Plus size={12} /> Tambah pilihan
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={field.is_required}
              onChange={(e) => update({ is_required: e.target.checked })}
              className="rounded border-[var(--line)] text-[var(--marigold)] focus:ring-[var(--marigold)]"
            />
            Wajib diisi pembeli
          </label>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-[var(--muted)] hover:text-[var(--brick)] transition-colors"
          aria-label="Hapus field"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
