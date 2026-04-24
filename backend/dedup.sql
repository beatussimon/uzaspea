DELETE FROM marketplace_review WHERE id NOT IN (SELECT MIN(id) FROM marketplace_review GROUP BY user_id, product_id);
