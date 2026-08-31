export interface ProductAttachment {
  id: number;
  title: string;
  price?: string | number;
  currency?: string;
  image?: string;
  category?: string;
}

export interface ParsedMessage {
  text: string;
  product?: ProductAttachment;
}

export function parseMessageContent(content: string): ParsedMessage {
  if (!content) return { text: '' };
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.includes('"type":"product_inquiry"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'product_inquiry' && parsed.product) {
        return {
          text: parsed.text || '',
          product: parsed.product,
        };
      }
    } catch {
      // fallback
    }
  }
  return { text: content };
}

export function getMessageDisplayText(content: string): string {
  const parsed = parseMessageContent(content);
  if (parsed.text) return parsed.text;
  if (parsed.product) return `Product inquiry: ${parsed.product.title}`;
  return content || '';
}

export function createProductInquiryPayload(
  product: {
    id: number;
    name?: string;
    title?: string;
    price?: string | number;
    currency?: string;
    image?: string;
    category?: string;
    category_name?: string;
  },
  text: string
): string {
  return JSON.stringify({
    type: 'product_inquiry',
    product: {
      id: product.id,
      title: product.name || product.title || 'Product',
      price: product.price,
      currency: product.currency || 'TZS',
      image: product.image || '',
      category: product.category_name || product.category || '',
    },
    text: text.trim(),
  });
}
