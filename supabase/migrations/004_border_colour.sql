-- Second swatch colour for two-tone sarees (body + border, e.g. Parrot Green with Pink border). Run once in SQL Editor.
alter table product_variants add column if not exists color_hex2 text;
