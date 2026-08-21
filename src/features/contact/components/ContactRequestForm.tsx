"use client";

import { useState } from 'react';
import type React from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';

const emptyForm = {
  name: '',
  email: '',
  subject: '',
  message: '',
  companyWebsite: '',
};

export function ContactRequestForm({
  kind = 'support',
  defaultEmail = '',
  defaultName = '',
  defaultSubject = '',
}: {
  kind?: 'support' | 'developer' | 'business';
  defaultEmail?: string | null;
  defaultName?: string | null;
  defaultSubject?: string;
}) {
  const [form, setForm] = useState({
    ...emptyForm,
    name: defaultName ?? '',
    email: defaultEmail ?? '',
    subject: defaultSubject,
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage(null);

    const response = await fetch('/api/contact/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        ...form,
        pageUrl: window.location.href,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      setStatus('error');
      setMessage(body?.error?.message ?? 'Unable to send the request.');
      return;
    }

    setStatus('sent');
    setMessage('Request sent. CardForge will follow up through the email you provided.');
    setForm({ ...emptyForm, name: defaultName ?? '', email: defaultEmail ?? '', subject: defaultSubject });
  };

  const inputClassName = 'border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]';

  return (
    <form onSubmit={submit} className="mt-8 border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-5 md:p-6">
      <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        Company website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.companyWebsite}
          onChange={(event) => setForm((current) => ({ ...current, companyWebsite: event.target.value }))}
        />
      </label>
      <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
        <Send className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">
          {kind === 'developer' ? 'Request developer access' : kind === 'business' ? 'Discuss a business solution' : 'Send a support request'}
        </h2>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
          Name
          <input
            required
            className={inputClassName}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
          Email
          <input
            required
            type="email"
            className={inputClassName}
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>
      </div>
      <label className="mt-3 grid gap-2 text-sm text-[var(--cf-text-muted)]">
        Subject
        <input
          required
          className={inputClassName}
          value={form.subject}
          onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
        />
      </label>
      <label className="mt-3 grid gap-2 text-sm text-[var(--cf-text-muted)]">
        Message
        <textarea
          required
          rows={6}
          className={`resize-y ${inputClassName}`}
          value={form.message}
          onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
        />
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={status === 'submitting'} className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110">
          <Send className="mr-2 h-4 w-4" />
          {status === 'submitting' ? 'Sending...' : kind === 'business' ? 'Send business inquiry' : 'Send request'}
        </Button>
        {message ? (
          <p className={`text-sm ${status === 'error' ? 'text-[var(--cf-warning)]' : 'text-[var(--cf-success)]'}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}