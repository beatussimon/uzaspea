from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from marketplace.models import Conversation, Message

class Command(BaseCommand):
    help = 'Merge duplicate and cross-role duplicate conversation threads'

    def handle(self, *args, **options):
        self.stdout.write("Starting conversation cleanup...")
        
        # 1. First find and merge exact duplicates (same buyer, seller, product)
        duplicates = (
            Conversation.objects.values('buyer', 'seller', 'product')
            .annotate(cnt=Count('id'))
            .filter(cnt__gt=1)
        )
        
        total_merged = 0
        
        for dup in duplicates:
            buyer_id = dup['buyer']
            seller_id = dup['seller']
            product_id = dup['product']
            
            convs = list(
                Conversation.objects.filter(buyer_id=buyer_id, seller_id=seller_id, product_id=product_id)
                .order_by('-updated_at')
            )
            
            if len(convs) <= 1:
                continue
                
            primary = convs[0]
            duplicates_to_delete = convs[1:]
            
            self.stdout.write(f"Merging {len(duplicates_to_delete)} duplicate threads into primary Conversation ID: {primary.id}")
            
            with transaction.atomic():
                for other in duplicates_to_delete:
                    Message.objects.filter(conversation=other).update(conversation=primary)
                    other.delete()
                    total_merged += 1
                    
        # 2. Next, merge reversed/cross duplicate threads between the same user pair (e.g. A->B and B->A)
        all_convs = list(Conversation.objects.all().order_by('-updated_at'))
        grouped_by_participants = {}
        
        for c in all_convs:
            key = (min(c.buyer_id, c.seller_id), max(c.buyer_id, c.seller_id))
            if key not in grouped_by_participants:
                grouped_by_participants[key] = []
            grouped_by_participants[key].append(c)
            
        for key, convs in grouped_by_participants.items():
            if len(convs) <= 1:
                continue
                
            primary = convs[0]
            duplicates_to_delete = convs[1:]
            
            self.stdout.write(f"Merging cross-role duplicate threads for users {key} into primary Conversation ID: {primary.id}")
            with transaction.atomic():
                for other in duplicates_to_delete:
                    Message.objects.filter(conversation=other).update(conversation=primary)
                    other.delete()
                    total_merged += 1
                    
        self.stdout.write(self.style.SUCCESS(f"Finished! Merged and cleaned up {total_merged} duplicate conversations."))
