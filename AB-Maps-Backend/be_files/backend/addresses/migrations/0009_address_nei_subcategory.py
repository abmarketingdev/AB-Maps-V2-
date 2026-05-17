# Generated manually for Nei subcategories

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('addresses', '0008_add_building_fk'),
    ]

    operations = [
        migrations.AddField(
            model_name='address',
            name='nei_subcategory',
            field=models.CharField(
                blank=True,
                choices=[
                    ('ikke_interessert', 'Ikke interessert'),
                    ('darlig_erfaring', 'Dårlig erfaring'),
                    ('bindingstid', 'Bindingstid'),
                    ('bedrift', 'Bedrift'),
                    ('pris', 'Pris'),
                    ('eksisterende_kunde', 'Eksisterende kunde'),
                ],
                help_text='When status is nei: why they declined (optional for legacy clients)',
                max_length=40,
                null=True,
            ),
        ),
    ]
