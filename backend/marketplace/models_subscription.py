from django.db import models

class SubscriptionTier(models.Model):
    name = models.CharField(max_length=20, unique=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    benefits = models.TextField(help_text="Comma-separated list or HTML for display")

    def __str__(self):
        return f"{self.name} (Tsh {self.price})"

class MobileNetwork(models.Model):
    name = models.CharField(max_length=50, unique=True)
    image = models.ImageField(upload_to='mobile-payments/')

    def __str__(self):
        return self.name

class LipaNamba(models.Model):
    network = models.ForeignKey(MobileNetwork, related_name='numbers', on_delete=models.CASCADE)
    number = models.CharField(max_length=30)

    def __str__(self):
        return f"{self.network.name}: {self.number}"
