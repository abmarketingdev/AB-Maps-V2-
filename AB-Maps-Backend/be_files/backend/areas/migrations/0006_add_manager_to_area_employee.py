# Generated migration to add manager support to AreaEmployee
# Following the same pattern as CampaignEmployee

from django.db import migrations, models, connection
import django.db.models.deletion


def drop_existing_unique_constraints(apps, schema_editor):
    """Drop existing unique constraints on area_employee table."""
    with connection.cursor() as cursor:
        # Drop the manually created unique constraint if it exists
        cursor.execute("""
            ALTER TABLE area_employee 
            DROP CONSTRAINT IF EXISTS area_employee_area_id_employee_id_unique
        """)
        
        # Also drop any Django-generated unique constraints
        cursor.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'area_employee' 
            AND constraint_type = 'UNIQUE'
            AND constraint_name LIKE '%area_id%employee_id%'
        """)
        constraints = cursor.fetchall()
        for constraint in constraints:
            constraint_name = constraint[0]
            # Validate constraint name contains only safe characters
            if constraint_name.replace('_', '').replace('-', '').isalnum():
                # Use proper identifier quoting for safety
                cursor.execute(f"""
                    ALTER TABLE area_employee 
                    DROP CONSTRAINT IF EXISTS "{constraint_name}"
                """)


def reverse_drop_constraints(apps, schema_editor):
    """Reverse operation - recreate the original unique constraint."""
    with connection.cursor() as cursor:
        # Recreate the original unique constraint
        cursor.execute("""
            ALTER TABLE area_employee 
            ADD CONSTRAINT IF NOT EXISTS area_employee_area_id_employee_id_unique 
            UNIQUE (area_id, employee_id)
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_add_ab_person_id'),
        ('areas', '0005_add_apartment_count'),
    ]

    operations = [
        # Drop existing unique constraints first
        migrations.RunPython(
            drop_existing_unique_constraints,
            reverse_drop_constraints,
        ),
        # Update verbose names
        migrations.AlterModelOptions(
            name='areaemployee',
            options={'verbose_name': 'Area Assignment', 'verbose_name_plural': 'Area Assignments'},
        ),
        # First, alter unique_together to remove the old constraint
        migrations.AlterUniqueTogether(
            name='areaemployee',
            unique_together=set(),
        ),
        # Add manager field (nullable)
        migrations.AddField(
            model_name='areaemployee',
            name='manager',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='area_assignments',
                to='users.manager'
            ),
        ),
        # Make employee field nullable
        migrations.AlterField(
            model_name='areaemployee',
            name='employee',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='area_assignments',
                to='users.employee'
            ),
        ),
        # Update unique_together to include both employee and manager
        migrations.AlterUniqueTogether(
            name='areaemployee',
            unique_together={('area', 'manager'), ('area', 'employee')},
        ),
        # Add check constraint to ensure exactly one person type
        migrations.AddConstraint(
            model_name='areaemployee',
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(('employee__isnull', False), ('manager__isnull', True)),
                    models.Q(('employee__isnull', True), ('manager__isnull', False)),
                    _connector='OR'
                ),
                name='area_employee_exactly_one_person'
            ),
        ),
    ]

