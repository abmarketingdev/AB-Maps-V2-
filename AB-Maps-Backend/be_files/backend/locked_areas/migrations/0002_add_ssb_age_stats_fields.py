# Generated manually to add SSB age statistics fields

from django.db import migrations, models


def add_field_if_not_exists(table, column, sql_type, apps, schema_editor):
    """Add a column only if it doesn't already exist."""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s AND column_name = %s",
            [table, column],
        )
        if not cursor.fetchone():
            cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {sql_type}')


def add_mean_age(apps, schema_editor):
    add_field_if_not_exists('locked_areas', 'mean_age', 'NUMERIC(5,1) NULL', apps, schema_editor)


def add_median_age(apps, schema_editor):
    add_field_if_not_exists('locked_areas', 'median_age', 'NUMERIC(5,1) NULL', apps, schema_editor)


def add_stats_year(apps, schema_editor):
    add_field_if_not_exists('locked_areas', 'stats_year', 'INTEGER NULL', apps, schema_editor)


def add_stats_updated_at(apps, schema_editor):
    add_field_if_not_exists('locked_areas', 'stats_updated_at', 'TIMESTAMP WITH TIME ZONE NULL', apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ('locked_areas', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_mean_age, migrations.RunPython.noop),
        migrations.RunPython(add_median_age, migrations.RunPython.noop),
        migrations.RunPython(add_stats_year, migrations.RunPython.noop),
        migrations.RunPython(add_stats_updated_at, migrations.RunPython.noop),
    ]
