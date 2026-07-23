from django.core.management.base import BaseCommand
import random
from django.utils import timezone
from datetime import timedelta
from staff.models import Task, TaskCategory, Department
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Seeds the database with sample tasks for the Staff Dashboard'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding tasks...')

        admin = User.objects.filter(is_superuser=True).first()
        staff_users = User.objects.filter(is_staff=True)

        if not admin:
            admin = User.objects.first()

        dept, _ = Department.objects.get_or_create(name='General Operations', description='Operations Department')

        cat1, _ = TaskCategory.objects.get_or_create(name='Review Operations', department=dept)
        cat2, _ = TaskCategory.objects.get_or_create(name='Warehouse Audit', department=dept)
        cat3, _ = TaskCategory.objects.get_or_create(name='Customer Escalation', department=dept)
        cats = [cat1, cat2, cat3]

        statuses = ['pending', 'in_progress', 'on_hold', 'completed']
        priorities = ['low', 'medium', 'high', 'urgent']
        titles = ['Review Seller Application', 'Audit Inventory Log', 'Resolve Dispute #1002', 'Approve Product Mod', 'Update Logistics Table']

        Task.objects.all().delete()  

        for i in range(15):
            status = random.choice(statuses)
            priority = random.choice(priorities)
            category = random.choice(cats)
            title = random.choice(titles) + f' {i+1}'
            
            assigned_to = random.choice(list(staff_users)) if staff_users else None
            if status == 'pending' and random.random() < 0.3:
                assigned_to = None
                
            due_date = timezone.now() + timedelta(days=random.randint(-2, 5))
            
            Task.objects.create(
                title=title,
                description=f'This is an auto-generated sample task for {title}. Please ensure all guidelines are followed.',
                category=category,
                created_by=admin,
                assigned_to=assigned_to,
                status=status,
                priority=priority,
                due_date=due_date
            )
        
        self.stdout.write(self.style.SUCCESS('Successfully seeded 15 tasks!'))
