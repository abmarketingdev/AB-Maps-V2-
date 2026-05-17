# Generated manually for new Svarte categories: Nøytral, Giverinspill, Reservert

from django.db import migrations, models


# New status columns for "Svarte" sub-categories
NEW_STATUS_CHOICES = [
    ('til_behandling', 'To be processed'),
    ('forste_oppring', 'First call attempt'),
    ('andre_oppring', 'Second call attempt'),
    ('tredje_oppring', 'Third call attempt'),
    ('si_opp', 'Cancellation requested'),
    ('negativ_tilbakemelding', 'Negative feedback'),
    ('positiv_tilbakemelding', 'Positive feedback'),
    ('other_inquiries', 'Other inquiries'),
    ('noeytral_tilbakemelding', 'Neutral'),
    ('giverinspill', 'Giverinspill'),
    ('reservert', 'Reserved'),
]

NEW_SVARTE_CATEGORY_CHOICES = [
    ('negativ', 'Negative'),
    ('positiv', 'Positive'),
    ('annen', 'Other'),
    ('noeytral', 'Neutral'),
    ('giverinspill', 'Giverinspill'),
    ('reservert', 'Reserved'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0002_phase9_indexes_constraints'),
    ]

    operations = [
        migrations.AlterField(
            model_name='qccontact',
            name='status',
            field=models.CharField(
                choices=NEW_STATUS_CHOICES,
                db_index=True,
                default='til_behandling',
                help_text='Current workflow status',
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='qccontact',
            name='svarte_category',
            field=models.CharField(
                blank=True,
                choices=NEW_SVARTE_CATEGORY_CHOICES,
                help_text="Sub-category when qc_result is 'Svarte'",
                max_length=20,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='qchistory',
            name='svarte_category',
            field=models.CharField(
                blank=True,
                choices=NEW_SVARTE_CATEGORY_CHOICES,
                help_text="Sub-category when qc_result is 'Svarte'",
                max_length=20,
                null=True,
            ),
        ),
    ]
