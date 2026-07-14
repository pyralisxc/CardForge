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
  kind?: 'support' | 'developer';
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

  return (
    <form onSubmit={submit} className="mt-8 border border-[#6d4f2b] bg-[#15100a] p-5 md:p-6">
      <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        Company website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.companyWebsite}
          onChange={(event) => setForm((current) => ({ ...current, companyWebsite: event.target.value }))}
        />
      </label>
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <Send className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-[#fff1c7]">
          {kind === 'developer' ? 'Request developer access' : 'Send a support request'}
        </h2>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-[#c7b288]">
          Name
          <input
            required
            className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label className="grid gap-2 text-sm text-[#c7b288]">
          Email
          <input
            required
            type="email"
            className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>
      </div>
      <label className="mt-3 grid gap-2 text-sm text-[#c7b288]">
        Subject
        <input
          required
          className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
          value={form.subject}
          onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
        />
      </label>
      <label className="mt-3 grid gap-2 text-sm text-[#c7b288]">
        Message
        <textarea
          required
          rows={6}
          className="resize-y border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
          value={form.message}
          onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
        />
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={status === 'submitting'} className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
          <Send className="mr-2 h-4 w-4" />
          {status === 'submitting' ? 'Sending...' : 'Send request'}
        </Button>
        {message ? (
          <p className={`text-sm ${status === 'error' ? 'text-[#f0bd75]' : 'text-[#bde3a8]'}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
