-- Sample data. Run after schema.sql. Delete these rows before launch.

insert into categories (slug, name, description, sort_order, is_active) values
  ('sarees',      'Sarees',      'Kanjivaram, Banarasi, soft silk and more', 1, true),
  ('blouses',     'Blouses',     'Designer and ready-made blouses',          2, false),  -- hidden for now
  ('ethnic-wear', 'Ethnic Wear', 'Kurtis, lehengas and festive sets',        3, true)
on conflict (slug) do nothing;

insert into products (slug, name, description, fabric, care, category_id, price, mrp,
                      is_bridal, is_new, is_clearance, sort_order)
select v.slug, v.name, v.description, v.fabric, v.care, c.id, v.price, v.mrp,
       v.is_bridal, v.is_new, v.is_clearance, v.sort_order
from (values
  ('kanjivaram-temple-border', 'Kanjivaram Temple Border Silk Saree', 'Pure silk with a classic temple border and rich zari pallu.', 'Pure Kanjivaram silk', 'Dry clean only', 'sarees', 12499, 15999, true,  true,  false, 1),
  ('banarasi-meenakari',       'Banarasi Meenakari Silk Saree',       'Handwoven Banarasi with meenakari buttas across the body.',   'Banarasi silk',        'Dry clean only', 'sarees',  8999, 11999, true,  false, false, 2),
  ('soft-silk-daily',          'Soft Silk Everyday Saree',            'Light soft silk, easy to drape for poojas and office.',       'Soft silk',            'Gentle hand wash in cold water', 'sarees', 2499, 3299, false, true, false, 3),
  ('mysore-crepe-silk',        'Mysore Crepe Silk Saree',             'Fluid crepe silk with a thin gold border.',                   'Mysore crepe silk',    'Dry clean recommended', 'sarees', 4799, 5999, false, false, false, 4),
  ('organza-floral',           'Organza Floral Print Saree',          'Sheer organza with hand-painted florals. Last pieces.',       'Organza',              'Dry clean only', 'sarees', 1899, 3499, false, false, true, 5),
  ('bridal-red-kanjivaram',    'Bridal Red Kanjivaram Saree',         'Heavy bridal Kanjivaram in auspicious red and gold.',         'Pure Kanjivaram silk', 'Dry clean only', 'sarees', 24999, 29999, true, true, false, 6),
  ('zari-work-blouse',         'Zari Work Designer Blouse',           'Ready-made blouse with zari embroidery on the sleeves.',      'Silk blend',           'Dry clean only', 'blouses', 1499, 1999, false, true, false, 7),
  ('chanderi-anarkali-kurti',  'Chanderi Anarkali Kurti',             'Flared Chanderi kurti with gota detailing.',                  'Chanderi cotton silk', 'Hand wash separately', 'ethnic-wear', 2199, 2799, false, true, false, 8),
  ('festive-lehenga-set',      'Festive Lehenga Set',                 'Lehenga, blouse and dupatta set for sangeet and mehendi.',    'Art silk',             'Dry clean only', 'ethnic-wear', 6999, 9499, true, false, false, 9)
) as v(slug, name, description, fabric, care, cat, price, mrp, is_bridal, is_new, is_clearance, sort_order)
join categories c on c.slug = v.cat
on conflict (slug) do nothing;

insert into product_variants (product_id, color, color_hex, size, sku, stock)
select p.id, v.color, v.hex, v.size, v.sku, v.stock
from (values
  ('kanjivaram-temple-border', 'Royal Purple', '#5E1A73', '',   'LPC-KTB-PUR', 4),
  ('kanjivaram-temple-border', 'Bottle Green', '#1F5E3B', '',   'LPC-KTB-GRN', 2),
  ('banarasi-meenakari',       'Rani Pink',    '#C2185B', '',   'LPC-BMK-PNK', 5),
  ('banarasi-meenakari',       'Navy Blue',    '#1A2A5E', '',   'LPC-BMK-NVY', 3),
  ('soft-silk-daily',          'Mustard',      '#D4A017', '',   'LPC-SSD-MUS', 10),
  ('soft-silk-daily',          'Peacock Blue', '#0F6E7A', '',   'LPC-SSD-PCK', 8),
  ('soft-silk-daily',          'Maroon',       '#6B1020', '',   'LPC-SSD-MRN', 6),
  ('mysore-crepe-silk',        'Ivory Gold',   '#EFE3C2', '',   'LPC-MCS-IVR', 7),
  ('organza-floral',           'Blush Pink',   '#F4C2C2', '',   'LPC-ORG-BLS', 1),
  ('bridal-red-kanjivaram',    'Bridal Red',   '#A3141E', '',   'LPC-BRK-RED', 2),
  ('zari-work-blouse',         'Gold',         '#C9A227', 'S',  'LPC-ZWB-GLD-S', 3),
  ('zari-work-blouse',         'Gold',         '#C9A227', 'M',  'LPC-ZWB-GLD-M', 4),
  ('zari-work-blouse',         'Gold',         '#C9A227', 'L',  'LPC-ZWB-GLD-L', 2),
  ('chanderi-anarkali-kurti',  'Mint',         '#9ED9C3', 'M',  'LPC-CAK-MNT-M', 5),
  ('chanderi-anarkali-kurti',  'Mint',         '#9ED9C3', 'L',  'LPC-CAK-MNT-L', 3),
  ('chanderi-anarkali-kurti',  'Mint',         '#9ED9C3', 'XL', 'LPC-CAK-MNT-XL', 0),
  ('festive-lehenga-set',      'Wine',         '#5A1030', 'Free size', 'LPC-FLS-WIN', 0)
) as v(slug, color, hex, size, sku, stock)
join products p on p.slug = v.slug
on conflict (sku) do nothing;

insert into coupons (code, discount_type, value, min_order, max_discount, usage_limit, is_active) values
  ('WELCOME10',  'percent', 10, 999,  500, null, true),
  ('FESTIVE300', 'flat',   300, 2999, null, 500, true)
on conflict (code) do nothing;
