import { useEffect, useRef, useState } from 'react';
import type { TemplatePromptInput } from '../lib/templates';
import { Icon } from './Icon';

export function TemplatePromptDialog({ input, onResolve }: { input: TemplatePromptInput; onResolve: (value: string | null) => void }) {
  const [value, setValue] = useState(input.defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  return <div className="modal-backdrop" onMouseDown={() => onResolve(null)} role="presentation">
    <form aria-labelledby="template-prompt-title" aria-modal="true" className="modal template-prompt-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onResolve(value); }} role="dialog">
      <header><div><small>Request input</small><h2 id="template-prompt-title">{input.title}</h2></div><button aria-label="Cancel prompt" className="icon-button subtle" onClick={() => onResolve(null)} type="button"><Icon name="x" /></button></header>
      <div className="template-prompt-field"><label>{input.label || input.title}<input autoComplete="off" onChange={(event) => setValue(event.target.value)} ref={inputRef} type={input.maskText ? 'password' : 'text'} value={value} /></label></div>
      <footer><button className="modal-cancel" onClick={() => onResolve(null)} type="button">Cancel</button><button className="primary-button" type="submit">Use value</button></footer>
    </form>
  </div>;
}
