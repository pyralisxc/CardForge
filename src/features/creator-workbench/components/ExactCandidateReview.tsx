'use client';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { DisplayCard } from '@/domain/rendering';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { renderCardToPngBlob } from '@/features/card-generator/client';
import { SaveAsPdfButton } from '@/features/card-generator/client/export';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import type { ExactCandidateSpecimen } from '@/features/pipeline/client';

type Specimen = ExactCandidateSpecimen;
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,x]) => [k,canonical(x)])) : v;
const digest = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map(v => v.toString(16).padStart(2,'0')).join('');
async function requestSpecimen(identity: unknown): Promise<Specimen> {
  const response = await fetch('/api/pipeline/candidate-review', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity) });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Exact candidate review is unavailable.'));
  const result = await response.json() as Specimen;
  if (JSON.stringify(canonical(result.identity)) !== JSON.stringify(canonical(identity)) || await digest(result.template) !== result.hydratedSha256) throw new Error('Candidate handoff changed. Export blocked.');
  return result;
}
export function ExactCandidateReview() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ specimen: Specimen; card: DisplayCard; png: string } | null>(null);
  async function load() {
    setBusy(true); setError(''); setReview(null);
    try {
      const specimen = await requestSpecimen(JSON.parse(input));
      const template = reconstructMinimalTemplateObject(specimen.template);
      const data = { ...template.templatePreviewData };
      for (const field of template.fieldContracts ?? []) if (data[field.key] === undefined && field.defaultValue !== undefined) data[field.key] = field.defaultValue;
      const card: DisplayCard = { template, data, uniqueId: specimen.identity.submissionId };
      const blob = await renderCardToPngBlob(card, 'virtual', 150);
      const png = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
      setReview({ specimen, card, png });
    } catch (e) { setError(e instanceof Error ? e.message : 'Specimen rendering failed.'); }
    finally { setBusy(false); }
  }
  async function revalidate() {
    if (!review) throw new Error('No verified specimen.');
    try {
      const latest = await requestSpecimen(review.specimen.identity);
      if (latest.hydratedSha256 !== review.specimen.hydratedSha256 || await digest(review.specimen.template) !== latest.hydratedSha256) throw new Error('Candidate media changed. Reload the specimen.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Candidate recheck failed.'); setReview(null); throw e; }
  }
  return <main className="mx-auto max-w-3xl space-y-4 p-6">
    <h1>Exact candidate review</h1>
    <p>Owner-only specimen of a pending Template. This does not approve, publish or save the candidate.</p>
    <label className="block">Exact candidate identity JSON<textarea className="block w-full border bg-background p-2 text-foreground" rows={8} value={input} disabled={busy} onChange={e => { setInput(e.target.value); setReview(null); }} /></label>
    <Button disabled={busy} onClick={() => void load()}>{busy ? 'Rendering specimen…' : 'Render exact specimen'}</Button>
    {error && <p role="alert">{error}</p>}
    {review && <section aria-label="Verified candidate specimen">
      <p>Revision {review.specimen.identity.revisionNumber} · submission {review.specimen.identity.submissionId}</p>
      <p className="break-all">Source SHA-256: {review.specimen.identity.sourceSha256}</p>
      {/* Canonical rendered pixels, never a published catalog thumbnail. */}
      <img src={review.png} alt="Exact pending candidate specimen" style={{ maxWidth: '100%', maxHeight: 600 }} />
      <SaveAsPdfButton generatedDisplayCards={[review.card]} selectedPaperSize={{ name: 'A4', widthMm: 210, heightMm: 297 }} pdfMarginMm={10} pdfCardSpacingMm={0} pdfIncludeCutLines={false} pdfDuplexLayout="same-page" exportMode="virtual" pdfProfile="screen" exportDpi={150} richTextHighlightColor="#fbbf24" canExportClean={false} templateName={`review-${review.specimen.identity.submissionId}-r${review.specimen.identity.revisionNumber}-${review.specimen.identity.sourceSha256}`} beforeExport={revalidate} />
      <p>Watermarked reviewer PDF; no publication or editable project is created. Identity is preserved in the filename.</p>
    </section>}
  </main>;
}
