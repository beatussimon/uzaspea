import re

file_path = '/home/bea/uzaspea/frontend/src/pages/OrdersPage.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Add advancing state to OrdersPage
if 'const [advancing, setAdvancing] = useState<number | null>(null);' not in content:
    pattern = r'(const \[expandedId, setExpandedId\] = useState<number \| null>\(null\);)'
    replacement = r'\1\n  const [advancing, setAdvancing] = useState<number | null>(null);'
    content = re.sub(pattern, replacement, content, count=1)


invoice_review_block = """
                    {/* Invoice Confirmation */}
                    {order.status === 'INVOICE_GENERATED' && (
                      <div className="px-6 py-6 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                        <div className="flex items-start gap-4">
                          <Receipt className="text-blue-600 shrink-0 mt-1" size={24} />
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-2">Invoice Ready for Review</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              The seller has reviewed your quote request and generated an invoice with final prices. 
                              Please review the total amount (TSh {parseInt(order.total_amount || 0).toLocaleString()}) and accept to proceed to payment.
                            </p>
                            <button 
                              disabled={advancing === order.id}
                              onClick={async () => {
                                setAdvancing(order.id);
                                try {
                                  await api.post(`/api/orders/${order.id}/confirm-invoice/`);
                                  toast.success('Invoice accepted! Proceeding to payment.');
                                  fetchOrders(1, true);
                                } catch (e) {
                                  toast.error('Failed to accept invoice.');
                                } finally {
                                  setAdvancing(null);
                                }
                              }}
                              className="btn-primary py-2 px-6"
                            >
                              {advancing === order.id ? 'Accepting...' : 'Accept Invoice & Pay'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
"""

pattern2 = r'({/\* Offline Payment Instructions & Form \*/})'
if 'Invoice Ready for Review' not in content:
    content = re.sub(pattern2, invoice_review_block + r'\n                    \1', content, count=1)


with open(file_path, 'w') as f:
    f.write(content)

print("Patched OrdersPage.tsx")
