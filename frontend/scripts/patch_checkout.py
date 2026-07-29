import re
import os

file_path = '/home/bea/uzaspea/frontend/src/pages/CheckoutPage.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Insert hasQuoteItem
has_quote = "  const hasQuoteItem = useMemo(() => checkoutItems.some(i => i.requires_quote), [checkoutItems]);\n"
content = re.sub(r'(const checkoutTotal = useMemo[^\n]+\n)', r'\1' + has_quote, content, count=1)

# 2. Update handleSubmit
rfq_logic = """
      if (hasQuoteItem) {
        setSubmitting(true);
        try {
          const rfqData = {
            items: checkoutItems.map(i => {
              let pId = i.productId;
              if (typeof pId === 'string' && pId.includes('-')) pId = parseInt(pId.split('-')[0], 10);
              return { product_id: pId, quantity: i.quantity };
            }),
            shipping_method: shippingMethod,
            fulfillment_type: fulfillmentType
          };
          const res = await api.post('/api/orders/request-invoice/', rfqData);
          setCheckoutSuccess(true);
          clearCartByMerchant(merchant);
          toast.success(t('quote_requested_success', 'Quote requested successfully!'));
          setTimeout(() => navigate(`/orders?highlight=${res.data.order_id}`), 100);
        } catch (error: any) {
          toast.error(error.response?.data?.error || t('request_failed', 'Failed to request quote.'));
        } finally {
          setSubmitting(false);
        }
        return;
      }
"""

# Find handleSubmit start
pattern_submit = r'(const handleSubmit = async \(e: React\.FormEvent\) => {\n    e\.preventDefault\(\);\n)'
content = re.sub(pattern_submit, r'\1' + rfq_logic, content, count=1)


# 3. Update Button text
button_pattern = r"(<CreditCard size=\{16\} />\n\s+)\{t\('pay_product_price', 'Pay Product Price — TSh \{\{price\}\}', \{ price: finalTotal\.toLocaleString\(\) \}\)\}"
button_replacement = r"\1{hasQuoteItem ? t('request_invoice', 'Request Invoice') : t('pay_product_price', 'Pay Product Price — TSh {{price}}', { price: finalTotal.toLocaleString() })}"
content = re.sub(button_pattern, button_replacement, content, count=1)

# Also if hasQuoteItem, we might want to hide the CreditCard icon or change it.
button_pattern2 = r"<CreditCard size=\{16\} />"
button_replacement2 = r"{hasQuoteItem ? <Shield size={16} /> : <CreditCard size={16} />}"
content = re.sub(button_pattern2, button_replacement2, content, count=1)


with open(file_path, 'w') as f:
    f.write(content)

print("Patched CheckoutPage.tsx")
