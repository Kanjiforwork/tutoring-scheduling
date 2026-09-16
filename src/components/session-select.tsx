'use client';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption { value: string; label: string; hint?: string; disabled?: boolean }
export function SessionSelect({ label, value, options, onChange, placeholder = 'Select an option', required = false, editField, availability }: {
  label: string; value: string; options: SelectOption[]; onChange: (value: string) => void;
  placeholder?: string; required?: boolean; editField?: string; availability?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const selected = options.find(option => option.value === value);
  const hint = missing ? `Choose a ${label.toLowerCase()}.` : availability || selected?.hint;
  const close = () => { menu.current?.hidePopover(); trigger.current?.focus(); };
  const position = () => {
    if (!trigger.current || trigger.current.matches(':disabled') || !menu.current) return;
    const box = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    const height = Math.min(280, Math.max(below, above));
    const top = below >= Math.min(240, above) ? box.bottom + 5 : Math.max(8, box.top - height - 5);
    Object.assign(menu.current.style, { left: `${Math.max(8, Math.min(box.left, window.innerWidth - Math.min(box.width, window.innerWidth - 16) - 8))}px`, top: `${top}px`, width: `${Math.min(box.width, window.innerWidth - 16)}px`, maxHeight: `${height}px` });
  };
  useLayoutEffect(() => {
    if (!open) return;
    position();
    const reposition = () => position();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
  });
  const show = (last = false) => {
    if (!trigger.current || trigger.current.matches(':disabled') || !menu.current) return;
    position();
    menu.current.showPopover();
    const buttons = menu.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    const current = menu.current.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)');
    (current ?? buttons[last ? buttons.length - 1 : 0])?.focus();
  };
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Tab') { menu.current?.hidePopover(); trigger.current?.focus(); return; }
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const ordered = [...buttons.slice(index + 1), ...buttons.slice(0, index + 1)];
      const match = ordered.find(button => button.dataset.label?.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match) { event.preventDefault(); match.focus(); return; }
    }
    if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
  };
  return <span className="session-select">
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" aria-required={required} aria-invalid={missing || !!selected?.hint} aria-describedby={hint ? `${id}-hint` : undefined} data-edit-field={editField}
      className={`session-select-trigger${selected?.hint || missing ? ' has-warning' : ''}`} onClick={() => open ? close() : show()} onKeyDown={event => { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); show(event.key === 'ArrowUp'); } }}>
      <span className={selected ? '' : 'select-placeholder'}>{selected?.label || placeholder}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    <select className="select-validity" aria-hidden="true" tabIndex={-1} required={required} value={value} onChange={event => onChange(event.target.value)} onInvalid={event => { event.preventDefault(); setMissing(true); trigger.current?.focus(); }}><option value="" />{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    <div ref={menu} id={id} popover="auto" role="listbox" aria-label={label} className="session-select-menu" onKeyDown={navigate} onToggle={() => setOpen(menu.current?.matches(':popover-open') ?? false)}>
      {options.map(option => <button type="button" role="option" key={option.value} data-label={option.label} aria-selected={value === option.value} disabled={option.disabled} onClick={() => { onChange(option.value); setMissing(false); close(); }} className="session-select-option"><span className="select-option-copy"><span>{option.label}</span>{option.hint && <small>{option.hint}</small>}</span>{value === option.value && <Check size={15} aria-hidden="true" />}</button>)}
    </div>
    {hint && <span id={`${id}-hint`} className={`select-hint${availability ? ' select-hint-neutral' : ''}`} aria-live="polite">{hint}</span>}
  </span>;
}
