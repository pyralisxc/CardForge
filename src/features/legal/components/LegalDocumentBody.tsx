import React from 'react';

import { parseLegalBody, parseLegalInline } from '../model/legalBody';

const renderInline = (text: string) => (
  parseLegalInline(text).map((part, index) => (
    part.type === 'link'
      ? <a className="text-[var(--cf-accent-text)] underline" href={part.href} key={`${part.href}-${index}`}>{part.text}</a>
      : <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>
  ))
);

export function LegalDocumentBody({ body }: { body: string }) {
  return (
    <div className="space-y-5 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 text-sm leading-7 text-[#d2bd91] md:p-8">
      {parseLegalBody(body).map((block, index) => {
        if (block.type === 'heading') {
          return block.level === 2
            ? <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]" key={`heading-${index}`}>{renderInline(block.text)}</h2>
            : <h3 className="font-serif text-xl text-[var(--cf-text-strong)]" key={`heading-${index}`}>{renderInline(block.text)}</h3>;
        }

        if (block.type === 'list') {
          return (
            <ul className="list-disc space-y-2 pl-5" key={`list-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`item-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        return <p key={`paragraph-${index}`}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
