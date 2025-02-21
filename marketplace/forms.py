from django import forms
from .models import Product, Review, Category, Order, ProductImage, UserProfile, Subscription  # Import Subscription
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.forms import inlineformset_factory

class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ['name', 'description', 'price', 'stock', 'category', 'is_available', 'condition']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'category': forms.Select(),  # Use a Select widget
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Use optgroups for categories
        choices = []
        for category in Category.objects.filter(parent=None):  # Top-level
            choices.append((category.pk, str(category))) # add the category
            for subcategory in category.children.all(): # add the children
                choices.append((subcategory.pk, "— " + str(subcategory))) # added child.
        self.fields['category'].widget.choices = choices


class ProductImageForm(forms.ModelForm):
    class Meta:
        model = ProductImage
        fields = ['image']

ProductImageFormSet = inlineformset_factory(
    Product, ProductImage, form=ProductImageForm, extra=5, max_num=5, can_delete=True
)

class ReviewForm(forms.ModelForm):
    class Meta:
        model = Review
        fields = ['rating', 'comment']
        widgets = {
            'comment': forms.Textarea(attrs={'rows': 3}),
        }

class ReplyForm(forms.ModelForm):
    class Meta:
        model = Review
        fields = ['comment']
        widgets = {
            'comment': forms.Textarea(attrs={'rows':3})
        }


class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    phone_number = forms.CharField(required=True, widget=forms.TextInput(attrs={'placeholder': 'Phone Number'}))
    instagram_username = forms.CharField(required=False, widget=forms.TextInput(attrs={'placeholder': 'Instagram Username (optional)'}))
    website = forms.URLField(required=False, widget=forms.URLInput(attrs={'placeholder': 'Website URL (optional)'}))


    class Meta(UserCreationForm.Meta):
        model = User
        fields = UserCreationForm.Meta.fields + ('email',)

    def save(self, commit=True):
        user = super().save(commit=False)
        if commit:
            user.save()
            # Access the profile (it's automatically created by the signal) and update.
            profile = user.profile
            profile.phone_number = self.cleaned_data['phone_number']
            profile.instagram_username = self.cleaned_data['instagram_username']
            profile.website = self.cleaned_data['website']
            profile.save()
        return user

# --- Subscription Form ---
class SubscriptionForm(forms.Form):  # Not a ModelForm
    email = forms.EmailField(widget=forms.EmailInput(attrs={'placeholder': 'Your Email', 'class': 'form-control'}))
    category = forms.ModelChoiceField(
        queryset=Category.objects.all(),
        required=False,  # Allow no specific category
        empty_label="All Categories",  # Default option
        widget=forms.Select(attrs={'class': 'form-select'}) # Use form-select for consistent Bootstrap styling
    )

    # Custom validation to prevent duplicate subscriptions
    def clean_email(self):
        email = self.cleaned_data['email']
        category = self.cleaned_data.get('category')  # Use .get() for optional fields
        if Subscription.objects.filter(email=email, category=category).exists():
            raise forms.ValidationError("You are already subscribed to this category.")
        return email