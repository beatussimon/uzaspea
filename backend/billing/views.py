from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from uzachuo.permissions import IsSellerOrAbove
from .models import CommissionLedgerEntry, MonthlyInvoice, CommissionPayment
from .serializers import CommissionLedgerEntrySerializer, MonthlyInvoiceSerializer, CommissionPaymentSerializer

from django.db.models import Sum

class BillingViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSellerOrAbove]

    def get_queryset(self):
        return MonthlyInvoice.objects.filter(seller=self.request.user)

    @action(detail=False, methods=['get'])
    def ledger(self, request):
        entries = CommissionLedgerEntry.objects.filter(seller=request.user)
        
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            entries = entries.filter(created_at__gte=start_date)
        if end_date:
            entries = entries.filter(created_at__lte=end_date)
            
        totals = entries.aggregate(
            total_order_amount=Sum('order_amount'),
            total_commission=Sum('commission_amount')
        )
        
        page = self.paginate_queryset(entries)
        if page is not None:
            serializer = CommissionLedgerEntrySerializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['totals'] = totals
            return response
            
        serializer = CommissionLedgerEntrySerializer(entries, many=True)
        return Response({'results': serializer.data, 'totals': totals})

    @action(detail=False, methods=['get'])
    def invoices(self, request):
        invoices = MonthlyInvoice.objects.filter(seller=request.user)
        
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            invoices = invoices.filter(created_at__gte=start_date)
        if end_date:
            invoices = invoices.filter(created_at__lte=end_date)
            
        page = self.paginate_queryset(invoices)
        if page is not None:
            serializer = MonthlyInvoiceSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = MonthlyInvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def pay_invoice(self, request, pk=None):
        try:
            invoice = MonthlyInvoice.objects.get(pk=pk)
        except MonthlyInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        if invoice.seller != request.user:
            return Response({'error': 'You do not have permission to pay this invoice.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CommissionPaymentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(invoice=invoice, submitted_by=request.user)
            # Mark invoice as pending review
            invoice.status = MonthlyInvoice.Status.PENDING_REVIEW
            invoice.save(update_fields=['status'])
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
