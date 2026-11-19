-- Product detail fields (saree specs, authenticity, origin, video). Run once in SQL Editor.
alter table products
  add column if not exists saree_length text,      -- e.g. 5.5 m
  add column if not exists saree_width  text,      -- e.g. 1.15 m (45 in)
  add column if not exists blouse_piece text,      -- e.g. Included · 0.8 m unstitched, contrast
  add column if not exists composition  text,      -- e.g. 100% pure mulberry silk, pure zari
  add column if not exists weave        text,      -- e.g. Handloom, korvai border
  add column if not exists origin       text,      -- e.g. Kanchipuram, Tamil Nadu
  add column if not exists occasion     text,      -- e.g. Weddings, poojas, festivals
  add column if not exists silk_mark    boolean not null default false,
  add column if not exists video_url    text;

-- Sample values for the seed products (skipped if they don't exist)
update products set saree_length='5.5 m', saree_width='1.15 m (45 in)', blouse_piece='Included · 0.8 m unstitched, contrast border',
  composition='100% pure mulberry silk, pure zari', weave='Handloom Kanjivaram, korvai border', origin='Kanchipuram, Tamil Nadu',
  occasion='Weddings, receptions, poojas', silk_mark=true
  where slug in ('kanjivaram-temple-border','bridal-red-kanjivaram');
update products set saree_length='5.5 m', saree_width='1.1 m (44 in)', blouse_piece='Included · 0.8 m unstitched',
  composition='Pure Katan silk, gold zari', weave='Handloom Banarasi, meenakari buttas', origin='Varanasi, Uttar Pradesh',
  occasion='Weddings, festivals', silk_mark=true where slug = 'banarasi-meenakari';
update products set saree_length='5.5 m', saree_width='1.1 m', blouse_piece='Included · 0.8 m unstitched',
  composition='Soft silk blend', weave='Powerloom', origin='Tamil Nadu', occasion='Poojas, office, family functions'
  where slug = 'soft-silk-daily';
update products set saree_length='5.5 m', saree_width='1.15 m', blouse_piece='Included · 0.8 m unstitched',
  composition='Pure crepe silk (KSIC style)', weave='Powerloom, thin zari border', origin='Mysuru, Karnataka',
  occasion='Parties, office events' where slug = 'mysore-crepe-silk';
update products set saree_length='5.5 m', saree_width='1.1 m', blouse_piece='Not included',
  composition='Organza (silk-nylon blend)', weave='Printed, hand-painted florals', origin='Surat, Gujarat',
  occasion='Day functions, haldi, parties' where slug = 'organza-floral';
