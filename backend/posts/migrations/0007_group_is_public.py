from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0006_comment_parent'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='is_public',
            field=models.BooleanField(default=True),
        ),
    ]
