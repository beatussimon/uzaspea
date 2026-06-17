from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import CommissionLedgerEntry, MonthlyInvoice, CommissionPayment
from .serializers import CommissionLedgerEntrySerializer, MonthlyInvoiceSerializer, CommissionPaymentSerializer

class BillingViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def ledger(self, request):
        entries = CommissionLedgerEntry.objects.filter(seller=request.user)
        page = self.paginate_queryset(entries)
        if page is not None:
            serializer = CommissionLedgerEntrySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = CommissionLedgerEntrySerializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def invoices(self, request):
        invoices = MonthlyInvoice.objects.filter(seller=request.user)
        page = self.paginate_queryset(invoices)
        if page is not None:
            serializer = MonthlyInvoiceSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = MonthlyInvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def pay_invoice(self, request, pk=None):
        try:
            invoice = MonthlyInvoice.objects.get(pk=pk, seller=request.user)
        except MonthlyInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CommissionPaymentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(invoice=invoice, submitted_by=request.user)
            # Mark invoice as pending review
            invoice.status = MonthlyInvoice.Status.PENDING_REVIEW
            invoice.save(update_fields=['status'])
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
