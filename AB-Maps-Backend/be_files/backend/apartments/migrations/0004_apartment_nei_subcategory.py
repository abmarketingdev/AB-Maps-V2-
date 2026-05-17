# Generated manually — mirrors Address.nei_subcategory for historical apartment rows

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('apartments', '0003_fix_unique_constraint'),
    ]

    operations = [
        migrations.AddField(
            model_name='apartment',
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
                help_text='When status is nei: mirrored from visit Address; kept after address unlink',
                max_length=40,
                null=True,
            ),
        ),
    ]
