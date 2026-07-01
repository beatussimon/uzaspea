SELECT p.name, c.name, c.slug, c.parent_id, p.id FROM marketplace_product p JOIN marketplace_category c ON p.category_id = c.id WHERE p.name LIKE '%Sokonimax product%';
