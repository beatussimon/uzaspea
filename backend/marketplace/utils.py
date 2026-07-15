import os
import logging
from PIL import Image as PILImage
from django.core.files.base import ContentFile
from io import BytesIO

logger = logging.getLogger(__name__)

def convert_and_save_image(instance, field_name='image', max_width=1200):
    """
    Utility helper to resize an uploaded image to a maximum width
    (preserving aspect ratio) and convert it to WebP format.
    """
    image_field = getattr(instance, field_name)
    if not image_field:
        return

    try:
        # Check if the file exists on the filesystem
        if not os.path.exists(image_field.path):
            return

        img = PILImage.open(image_field.path)
        
        # Check if it already satisfies format and dimension constraints
        # img.format may be None after opening/saving in some contexts, so check file extension or format
        is_webp = img.format == 'WEBP' or image_field.name.lower().endswith('.webp')
        if is_webp and img.width <= max_width:
            return

        # Resize if necessary
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), PILImage.Resampling.LANCZOS)

        # Convert colorspace mode if needed for WebP format compatibility
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")

        webp_io = BytesIO()
        img.save(webp_io, format='WEBP', quality=80)

        # Delete the old file from storage to avoid orphan duplicates
        old_path = image_field.path
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception as remove_err:
                logger.warning("Could not delete old file %s: %s", old_path, str(remove_err))

        # Build optimized WebP file name
        base_name = os.path.splitext(os.path.basename(image_field.name))[0]
        new_filename = f"{base_name}.webp"

        # Save WebP data back into model ImageField
        image_field.save(new_filename, ContentFile(webp_io.getvalue()), save=False)
        
        # Re-save the model instance updating only the image path in database
        instance.save(update_fields=[field_name])
    except Exception as e:
        logger.exception("Failed to convert image to WebP format: %s", str(e))