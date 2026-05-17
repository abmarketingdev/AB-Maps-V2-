# Generated for per-user favourite contacts (Ros / positive feedback)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0003_svarte_categories_noeytral_giverinspill_reservert'),
    ]

    operations = [
        migrations.CreateModel(
            name='QCFavourite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(
                    help_text='Contact that was favourited',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='favourited_by',
                    to='qc_system.qccontact',
                )),
                ('user', models.ForeignKey(
                    help_text='QC user who favourited this contact',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='qc_favourites',
                    to='users.user',
                )),
            ],
            options={
                'verbose_name': 'QC Favourite',
                'verbose_name_plural': 'QC Favourites',
                'db_table': 'qc_favourite',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='qcfavourite',
            constraint=models.UniqueConstraint(
                fields=('user', 'contact'),
                name='qc_favourite_user_contact_unique',
            ),
        ),
        migrations.AddIndex(
            model_name='qcfavourite',
            index=models.Index(fields=['user'], name='qc_favourite_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='qcfavourite',
            index=models.Index(fields=['contact'], name='qc_favourite_contact_id_idx'),
        ),
    ]
