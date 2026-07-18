create table public.cardforge_founder_profile (
  id text primary key check (id = 'cameron-locke'),
  hero_eyebrow text not null check (char_length(hero_eyebrow) between 1 and 80),
  hero_headline text not null check (char_length(hero_headline) between 1 and 120),
  introduction text not null check (char_length(introduction) between 1 and 1200),
  road_heading text not null check (char_length(road_heading) between 1 and 120),
  road_body text not null check (char_length(road_body) between 1 and 1200),
  current_heading text not null check (char_length(current_heading) between 1 and 120),
  current_body text not null check (char_length(current_body) between 1 and 1200),
  priorities jsonb not null check (
    jsonb_typeof(priorities) = 'array'
    and jsonb_array_length(priorities) between 1 and 5
  ),
  support_heading text not null check (char_length(support_heading) between 1 and 120),
  support_introduction text not null check (char_length(support_introduction) between 1 and 1200),
  support_use_summary text not null check (char_length(support_use_summary) between 1 and 1200),
  portrait_storage_path text check (
    portrait_storage_path is null
    or portrait_storage_path = 'founder/cameron-locke/portrait.webp'
  ),
  portrait_alt text not null check (char_length(portrait_alt) between 1 and 200),
  facebook_url text check (facebook_url is null or facebook_url ~ '^https://'),
  instagram_url text check (instagram_url is null or instagram_url ~ '^https://'),
  discord_url text check (discord_url is null or discord_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cardforge_founder_profile_touch_updated_at on public.cardforge_founder_profile;
create trigger cardforge_founder_profile_touch_updated_at
  before update on public.cardforge_founder_profile
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_founder_profile enable row level security;
revoke all on table public.cardforge_founder_profile from public, anon, authenticated, service_role;
grant select, insert, update on table public.cardforge_founder_profile to service_role;

insert into public.cardforge_founder_profile (
  id,
  hero_eyebrow,
  hero_headline,
  introduction,
  road_heading,
  road_body,
  current_heading,
  current_body,
  priorities,
  support_heading,
  support_introduction,
  support_use_summary,
  portrait_storage_path,
  portrait_alt,
  facebook_url,
  instagram_url,
  discord_url
)
values (
  'cameron-locke',
  'Hey, welcome in.',
  'I’m Cameron.',
  'I build and operate CardForge Studio as an Oregon sole proprietor. I use AI-assisted code generation alongside my own ideas, design choices, testing, and stubborn curiosity to turn useful product ideas into real software.',
  'The road here',
  'My path has not been a straight line. I’ve spent time in Hawaii, traveled, and spent time hitchhiking. Those experiences taught me about resourcefulness, freedom, hospitality, and how far you can get by staying curious and making the most of what is in front of you.',
  'What I’m building toward',
  'CardForge is the first product in a larger independent journey. I’m building products that help people make things, solve real problems, and create a more stable and generous life along the way.',
  '["Make CardForge easier for someone opening it for the first time.","Keep improving how complete sets are checked and downloaded.","Build a stable independent business around useful, creative products."]'::jsonb,
  'Help me keep building.',
  'Voluntary support helps pay for food, housing, transportation, development time, and the ordinary business costs behind the work.',
  'Food and daily life; housing and stability; transportation; hosting, software, testing, design resources, and independent development time.',
  null,
  'Portrait of Cameron Locke',
  null,
  null,
  null
)
on conflict (id) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-public-media',
  'cardforge-public-media',
  true,
  8388608,
  array['image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/webp'];

update public.cardforge_asset_registry
set
  file_size_bytes = 9993,
  metadata = $cardforge_playing_card${"template":{"id":"default-playing-card-theme","name":"Arcane Playing Card","aspectRatio":"63:88","templateSource":"default","templateUsage":"standard","templateCategory":"Playing card","templateDescription":"An illustrated playing-card layout with forged parchment, classic corner marks, unique artwork, and an optional title.","templateOrder":2,"templatePreviewData":{"Rank":"A","Suit":"♠","Artwork":"/card-assets/showcase/playing-cards/ace-of-spades.webp","CardTitle":"The Night Sentinel"},"frameStyle":"custom","cardBorderWidth":"0px","cardBorderStyle":"none","cardBorderRadius":"22px","appearance":{"material":{"baseColor":"#f4e2bb","textColor":"#2b1609","texture":{"kind":"uploaded","imageSource":"/card-assets/textures/arcane-forge/frame-playing-premium.webp","intensity":100}},"border":{"kind":"none","color":"transparent","width":0,"radius":22}},"cardBackgroundImageUrl":"/card-assets/textures/arcane-forge/frame-playing-premium.webp","baseBackgroundColor":"#f4e2bb","baseTextColor":"#2b1609","defaultElementBorderColor":"transparent","cardBorderColor":"transparent","fieldContracts":[{"key":"Rank","type":"text","label":"Rank","example":"A","required":true,"elementId":"pc-top-rank","multiline":false,"fontWeight":"font-bold","textAutoFit":true,"minFontSizePx":8},{"key":"Suit","type":"text","label":"Suit","example":"♥","required":true,"elementId":"pc-top-suit","multiline":false,"textAutoFit":true,"minFontSizePx":8},{"key":"Artwork","type":"image","label":"Card Artwork","example":"/card-assets/showcase/playing-cards/ace-of-spades.webp","required":false,"elementId":"pc-center-artwork","multiline":false,"textAutoFit":true,"minFontSizePx":8},{"key":"CardTitle","type":"text","label":"Card Title","example":"The Night Sentinel","required":false,"elementId":"pc-card-title","multiline":false,"textAlign":"center","fontWeight":"font-semibold","textAutoFit":true,"minFontSizePx":10}],"freeformCanvas":{"width":630,"height":880,"gridSize":20,"elements":[{"id":"pc-top-rank","type":"text","name":"Top Rank","x":53,"y":51,"width":80,"height":58,"rotation":0,"opacity":1,"zIndex":2,"locked":false,"content":"{{Rank:\"A\"}}","textColor":"#2b1609","backgroundColor":"transparent","fontFamily":"font-cinzel","fontSize":"text-base","fontSizePx":42,"fontWeight":"font-bold","textAlign":"center","fontStyle":"normal","padding":"p-1","borderWidth":"0px","borderRadius":"rounded-none","minHeight":"_auto_","imageObjectFit":"cover","strokeWidth":0,"appearance":{"border":{"kind":"none","width":0},"effects":{"shadow":2},"material":{"texture":{"kind":"none"},"baseColor":"transparent","textColor":"#2b1609"}},"lineHeight":"1.15","textAutoFit":true,"textMinFontSizePx":8,"generatorFieldKind":"text","generatorFieldRequired":true},{"id":"pc-top-suit","type":"text","name":"Top Suit","x":75,"y":108,"width":58,"height":50,"rotation":0,"opacity":1,"zIndex":2,"locked":false,"content":"{{Suit:\"♠\"}}","textColor":"#2b1609","backgroundColor":"transparent","fontFamily":"font-serif","fontSize":"text-base","fontSizePx":38,"fontWeight":"font-bold","textAlign":"center","fontStyle":"normal","padding":"p-1","borderWidth":"0px","borderRadius":"rounded-none","minHeight":"_auto_","imageObjectFit":"cover","strokeWidth":0,"appearance":{"border":{"kind":"none","width":0},"effects":{"shadow":2},"material":{"texture":{"kind":"none"},"baseColor":"transparent","textColor":"#2b1609"}},"lineHeight":"1.15","textAutoFit":true,"textMinFontSizePx":8,"generatorFieldKind":"text","generatorFieldRequired":true},{"id":"pc-center-artwork","type":"image","name":"Card Artwork","x":132,"y":164,"width":366,"height":474,"rotation":0,"opacity":1,"zIndex":1,"locked":false,"content":"Artwork","imageSource":"Artwork","textColor":"#f7e7bd","backgroundColor":"#17110b","fontFamily":"font-sans","fontSize":"text-sm","fontSizePx":14,"fontWeight":"font-normal","textAlign":"left","fontStyle":"normal","padding":"p-0","borderColor":"#9b6b2f","borderWidth":"border-2","borderRadius":"rounded-xl","minHeight":"_auto_","imageObjectFit":"cover","strokeWidth":0,"appearance":{"border":{"kind":"solid","color":"#9b6b2f","width":2,"radius":12},"effects":{"shadow":10,"innerShadow":4},"material":{"texture":{"kind":"none"},"baseColor":"#17110b"}}},{"id":"pc-card-title","type":"text","name":"Card Title","x":145,"y":650,"width":340,"height":46,"rotation":0,"opacity":1,"zIndex":2,"locked":false,"content":"{{CardTitle:\"The Night Sentinel\"}}","textColor":"#2b1609","backgroundColor":"rgba(244,226,187,0.82)","fontFamily":"font-cinzel","fontSize":"text-base","fontSizePx":20,"fontWeight":"font-semibold","textAlign":"center","fontStyle":"normal","padding":"p-1","borderColor":"#9b6b2f","borderWidth":"border","borderRadius":"rounded-md","minHeight":"_auto_","imageObjectFit":"cover","strokeWidth":0,"lineHeight":"1.1","textAutoFit":true,"textMinFontSizePx":10,"generatorFieldKind":"text","generatorFieldRequired":false},{"id":"pc-bottom-rank","type":"text","name":"Bottom Rank","x":500,"y":776,"width":80,"height":58,"rotation":180,"opacity":1,"zIndex":2,"locked":false,"content":"{{Rank:\"A\"}}","textColor":"#2b1609","backgroundColor":"transparent","fontFamily":"font-cinzel","fontSize":"text-base","fontSizePx":42,"fontWeight":"font-bold","textAlign":"center","fontStyle":"normal","padding":"p-1","borderWidth":"0px","borderRadius":"rounded-none","minHeight":"_auto_","imageObjectFit":"cover","strokeWidth":0,"appearance":{"border":{"kind":"none","width":0},"effects":{"shadow":2},"material":{"texture":{"kind":"none"},"baseColor":"transparent","textColor":"#2b1609"}},"lineHeight":"1.15","textAutoFit":true,"textMinFontSizePx":8,"generatorFieldKind":"text","generatorFieldRequired":false},{"id":"pc-bottom-suit","type":"text","name":"Bottom Suit","x":504,"y":722,"width":58,"height":50,"rotation":180,"opacity":1,"zIndex":2,"locked":false,"content":"{{Suit:\"♠\"}}","textColor":"#2b1609","backgroundColor":"transparent","fontFamily":"font-serif","fontSize":"text-base","fontSizePx":38,"fontWeight":"font-bold","textAlign":"center","fontStyle":"normal","padding":"p-1","borderWidth":"0px","borderRadius":"rounded-none","minHeight":"_auto_","imageObjectFit":"cover","strokeWidth":0,"appearance":{"border":{"kind":"none","width":0},"effects":{"shadow":2},"material":{"texture":{"kind":"none"},"baseColor":"transparent","textColor":"#2b1609"}},"lineHeight":"1.15","textAutoFit":true,"textMinFontSizePx":8,"generatorFieldKind":"text","generatorFieldRequired":false}]}},"sourceKind":"official-file-backed","sourcePath":"data/default-templates/default-playing-card-theme.json"}$cardforge_playing_card$::jsonb,
  updated_at = now()
where asset_id = 'default-playing-card-theme';
