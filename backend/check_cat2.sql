SELECT id, name, slug FROM marketplace_category WHERE id IN (SELECT category_id FROM marketplace_product WHERE name LIKE '%Sokonimax product%');
