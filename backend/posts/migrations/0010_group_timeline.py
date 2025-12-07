from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0009_merge_20251207_0027"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="group",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]

