SELECT p.name, c.slug FROM marketplace_orderitem oi JOIN marketplace_product p ON oi.product_id = p.id JOIN marketplace_category c ON p.category_id = c.id WHERE oi.order_id = 48;
